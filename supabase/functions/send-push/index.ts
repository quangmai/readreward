// ═══════════════════════════════════════════
// ReadReward — Send Push Notification Edge Function
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Set secret: supabase secrets set VAPID_PRIVATE_KEY=sz8aX0-ZEXswap0j5QWO4fMnYbAaL_OOT8aUwJVEqQg
// ═══════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BOk6L-xl3LZzdhfG5NyP8AUP9Nmo1DsjEi2RQ558BHmMcaPFQRwLMwcR7FG-0l5v-I-4zn_YAxFcmuN7dAkkEbE";
const VAPID_SUBJECT = "mailto:readreward@example.com";

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

// ── VAPID JWT ──
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

  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)
  ));
  return `${unsigned}.${b64urlEncode(sig)}`;
}

// ── HKDF ──
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  // Extract
  const extractKey = await crypto.subtle.importKey(
    "raw", salt.length ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", extractKey, ikm));
  // Expand
  const expandKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, concat(info, new Uint8Array([1]))));
  return output.slice(0, len);
}

// ── RFC 8291 Web Push Encryption ──
async function encrypt(p256dhB64: string, authB64: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const userAgent_public = b64urlDecode(p256dhB64);
  const auth_secret = b64urlDecode(authB64);
  const te = new TextEncoder();

  // 1. Generate ephemeral ECDH key pair
  const as_keypair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const as_public = new Uint8Array(await crypto.subtle.exportKey("raw", as_keypair.publicKey));

  // 2. ECDH: derive shared secret
  const ua_pubkey = await crypto.subtle.importKey(
    "raw", userAgent_public, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const ecdh_secret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: ua_pubkey }, as_keypair.privateKey, 256
  ));

  // 3. key_info = "WebPush: info\0" || ua_public || as_public
  const key_info = concat(te.encode("WebPush: info\0"), userAgent_public, as_public);

  // 4. IKM = HKDF(auth_secret, ecdh_secret, key_info, 32)
  const ikm = await hkdf(auth_secret, ecdh_secret, key_info, 32);

  // 5. Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);

  // 7. Nonce = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  // 8. Pad: plaintext || 0x02
  const padded = concat(plaintext, new Uint8Array([2]));

  // 9. AES-128-GCM encrypt
  const aes_key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce }, aes_key, padded
  ));

  // 10. Build aes128gcm body:
  //     salt (16) || record_size (4, big-endian) || key_id_len (1) || key_id (as_public, 65) || ciphertext
  const record_size = new ArrayBuffer(4);
  new DataView(record_size).setUint32(0, 4096);

  return concat(
    salt,                          // 16 bytes
    new Uint8Array(record_size),   // 4 bytes
    new Uint8Array([as_public.length]), // 1 byte (65)
    as_public,                     // 65 bytes
    ciphertext,                    // variable
  );
}

// ── Send push to one subscription ──
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth_key: string },
  payload: object,
  vapidPrivKey: string,
) {
  const jwt = await createVapidJwt(sub.endpoint, vapidPrivKey);
  const payloadStr = JSON.stringify(payload);

  let body: Uint8Array;
  let headers: Record<string, string>;

  try {
    // Try encrypted push (RFC 8291)
    body = await encrypt(sub.p256dh, sub.auth_key, new TextEncoder().encode(payloadStr));
    headers = {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
    };
  } catch (encErr) {
    // Fallback: send without payload (SW shows default message)
    console.error("Encryption failed, sending without payload:", encErr);
    body = new Uint8Array(0);
    headers = {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Length": "0",
      "TTL": "86400",
      "Urgency": "normal",
    };
  }

  const resp = await fetch(sub.endpoint, { method: "POST", headers, body });
  const respText = await resp.text();
  return { status: resp.status, body: respText };
}

// ── Main ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { parentId, title, body, type, url } = await req.json();
    if (!parentId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "parentId, title, and body required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const vapidPrivKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPrivKey) {
      return new Response(
        JSON.stringify({ error: "VAPID_PRIVATE_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions").select("*").eq("parent_id", parentId);

    if (subErr) {
      return new Response(
        JSON.stringify({ error: subErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!subs?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = { title, body, type: type || "general", url: url || "/", icon: "/icon-192.png" };
    const results: Array<{ status?: number; detail?: string; error?: string }> = [];

    for (const sub of subs) {
      try {
        const r = await sendPush(sub, payload, vapidPrivKey);
        results.push({ status: r.status, detail: r.body.slice(0, 200) });
        if (r.status === 404 || r.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      } catch (e) {
        results.push({ error: (e as Error).message });
      }
    }

    const sent = results.filter(r => r.status === 201).length;
    return new Response(
      JSON.stringify({ sent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});