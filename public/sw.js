// ═══════════════════════════════════════════
// ReadReward — Send Push Notification Edge Function
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Set secret: supabase secrets set VAPID_PRIVATE_KEY=sz8aX0-ZEXswap0j5QWO4fMnYbAaL_OOT8aUwJVEqQg
// ═══════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BOk6L-xl3LZzdhfG5NyP8AUP9Nmo1DsjEi2RQ558BHmMcaPFQRwLMwcR7FG-0l5v-I-4zn_YAxFcmuN7dAkkEbE";
const VAPID_SUBJECT = "mailto:mdquang90@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64urlDecode(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const p = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
  const d = atob(b + p);
  return Uint8Array.from(d, c => c.charCodeAt(0));
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...bs: Uint8Array[]): Uint8Array {
  const len = bs.reduce((s, b) => s + b.length, 0);
  const r = new Uint8Array(len);
  let o = 0;
  for (const b of bs) { r.set(b, o); o += b.length; }
  return r;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const sKey = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", sKey, ikm));
  const pKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = new Uint8Array(await crypto.subtle.sign("HMAC", pKey, concat(info, new Uint8Array([1]))));
  return t.slice(0, len);
}

async function createVapidJwt(endpoint: string, privKeyB64: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const enc = new TextEncoder();
  const h = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64urlEncode(enc.encode(JSON.stringify({ aud, exp, sub: VAPID_SUBJECT })));
  const unsigned = `${h}.${p}`;

  const privBytes = b64urlDecode(privKeyB64);
  const pubBytes = b64urlDecode(VAPID_PUBLIC_KEY);

  const key = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256",
    d: b64urlEncode(privBytes),
    x: b64urlEncode(pubBytes.slice(1, 33)),
    y: b64urlEncode(pubBytes.slice(33, 65)),
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  return `${unsigned}.${b64urlEncode(sig)}`;
}

async function encryptPayload(p256dhB64: string, authB64: string, data: Uint8Array): Promise<Uint8Array> {
  const uaPub = b64urlDecode(p256dhB64);
  const authSec = b64urlDecode(authB64);
  const enc = new TextEncoder();

  const localKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPub = new Uint8Array(await crypto.subtle.exportKey("raw", localKP.publicKey));
  const uaPubKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPubKey }, localKP.privateKey, 256));

  const ikm = await hkdf(authSec, secret, concat(enc.encode("WebPush: info\0"), uaPub, localPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const padded = concat(data, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);
  return concat(salt, new Uint8Array(rs.buffer), new Uint8Array([localPub.length]), localPub, ct);
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth_key: string }, payload: object, vapidPrivKey: string) {
  const jwt = await createVapidJwt(sub.endpoint, vapidPrivKey);
  const body = await encryptPayload(sub.p256dh, sub.auth_key, new TextEncoder().encode(JSON.stringify(payload)));

  const resp = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.length),
      "TTL": "86400",
      "Urgency": "normal",
    },
    body,
  });
  return { status: resp.status, body: await resp.text() };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { parentId, title, body, type, url } = await req.json();
    if (!parentId || !title || !body) {
      return new Response(JSON.stringify({ error: "parentId, title, and body required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const vapidPrivKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPrivKey) {
      return new Response(JSON.stringify({ error: "VAPID_PRIVATE_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error: subErr } = await supabase.from("push_subscriptions").select("*").eq("parent_id", parentId);

    if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = { title, body, type: type || "general", url: url || "/", icon: "/icon-192.png" };
    const results = [];

    for (const sub of subs) {
      try {
        const r = await sendPush(sub, payload, vapidPrivKey);
        results.push({ status: r.status, detail: r.body.slice(0, 200) });
        if (r.status === 404 || r.status === 410) await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } catch (e) {
        results.push({ error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ sent: results.filter(r => r.status === 201).length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});