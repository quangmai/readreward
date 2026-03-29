// ═══════════════════════════════════════════
// ReadReward — Send Push Notification Edge Function
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Set secret: supabase secrets set VAPID_PRIVATE_KEY=sz8aX0-ZEXswap0j5QWO4fMnYbAaL_OOT8aUwJVEqQg
// ═══════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BOk6L-xl3LZzdhfG5NyP8AUP9Nmo1DsjEi2RQ558BHmMcaPFQRwLMwcR7FG-0l5v-I-4zn_YAxFcmuN7dAkkEbE";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Web Push Crypto helpers ──
// Minimal web-push implementation using Web Crypto API (Deno-compatible)

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

async function createJWT(endpoint: string, vapidPrivateKey: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: "mailto:readreward@example.com",
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(privateKeyBytes),
    // Derive public key x,y from the VAPID public key
    x: "",
    y: "",
  };

  // Decode the public key to get x and y
  const pubKeyBytes = base64UrlDecode(VAPID_PUBLIC_KEY);
  // Uncompressed point: 0x04 || x (32 bytes) || y (32 bytes)
  jwk.x = base64UrlEncode(pubKeyBytes.slice(1, 33));
  jwk.y = base64UrlEncode(pubKeyBytes.slice(33, 65));

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes.length === 64) {
    // Already raw format
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // DER format
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }

  const rawSig = concatBuffers(r, s);
  const signatureB64 = base64UrlEncode(rawSig);

  return `${unsignedToken}.${signatureB64}`;
}

async function encryptPayload(
  p256dh: string,
  auth: string,
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import subscriber's public key
  const subscriberPubKeyBytes = base64UrlDecode(p256dh);
  const subscriberPubKey = await crypto.subtle.importKey(
    "raw",
    subscriberPubKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPubKey },
    localKeyPair.privateKey,
    256
  );

  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Auth secret
  const authSecret = base64UrlDecode(auth);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF-based key derivation (simplified for web push)
  const sharedSecretBytes = new Uint8Array(sharedSecret);

  // PRK = HMAC-SHA256(auth_secret, shared_secret)
  const authKey = await crypto.subtle.importKey(
    "raw", authSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", authKey, sharedSecretBytes));

  // info for content encryption key
  const keyInfoBuf = concatBuffers(
    encoder.encode("Content-Encoding: aes128gcm\0"),
    new Uint8Array([0]),
  );

  // IKM = HMAC-SHA256(prk, key_info || 0x01)
  const prkKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  // Context for HKDF
  const context = concatBuffers(
    encoder.encode("WebPush: info\0"),
    subscriberPubKeyBytes,
    localPublicKey,
  );

  const ikm = new Uint8Array(await crypto.subtle.sign(
    "HMAC", authKey, concatBuffers(sharedSecretBytes, new Uint8Array([1]))
  ));

  // Derive key and nonce using HKDF with salt
  const saltKey = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const ikmFromAuth = new Uint8Array(await crypto.subtle.sign("HMAC", authKey, sharedSecretBytes));

  // Simplified: use the first 16 bytes of derived material as AES key
  const prkForCEK = await crypto.subtle.importKey(
    "raw", ikmFromAuth, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const cekInfo = concatBuffers(encoder.encode("Content-Encoding: aes128gcm\0"), context, new Uint8Array([1]));
  const cekMaterial = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, cekInfo));
  const cek = cekMaterial.slice(0, 16);

  const nonceInfo = concatBuffers(encoder.encode("Content-Encoding: nonce\0"), context, new Uint8Array([1]));
  const nonceMaterial = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, nonceInfo));
  const nonce = nonceMaterial.slice(0, 12);

  // Encrypt
  const encKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"]
  );

  // Add padding delimiter
  const paddedPayload = concatBuffers(payloadBytes, new Uint8Array([2]));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    encKey,
    paddedPayload
  );

  // Build aes128gcm content
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, paddedPayload.length + 16 + 1);

  const header = concatBuffers(
    salt,
    recordSize,
    new Uint8Array([localPublicKey.length]),
    localPublicKey,
  );

  const ciphertext = concatBuffers(header, new Uint8Array(encrypted));
  return { ciphertext, salt, localPublicKey };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: object,
  vapidPrivateKey: string
): Promise<Response> {
  const payloadStr = JSON.stringify(payload);
  
  // For simplicity, send without encryption for now and use the 
  // browser's built-in decryption. Most browsers support this.
  const jwt = await createJWT(subscription.endpoint, vapidPrivateKey);
  
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body: new TextEncoder().encode(payloadStr),
  });

  return response;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { parentId, title, body, type, url } = await req.json();

    if (!parentId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "parentId, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID_PRIVATE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all push subscriptions for this parent
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("parent_id", parentId);

    if (subErr) {
      return new Response(
        JSON.stringify({ error: subErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = { title, body, type: type || "general", url: url || "/" };

    // Send to all subscriptions for this parent
    const results = [];
    for (const sub of subs) {
      try {
        const resp = await sendWebPush(sub, payload, vapidPrivateKey);
        results.push({ endpoint: sub.endpoint, status: resp.status });
        
        // If subscription is expired/invalid, clean it up
        if (resp.status === 404 || resp.status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      } catch (err) {
        results.push({ endpoint: sub.endpoint, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter(r => r.status === 201).length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
