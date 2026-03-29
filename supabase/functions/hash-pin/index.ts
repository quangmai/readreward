// supabase/functions/hash-pin/index.ts
// Deploy: supabase functions deploy hash-pin --no-verify-jwt

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string): Promise<string> {
  // Generate 16 random bytes as salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt.buffer);
  // Hash: SHA-256(salt + pin)
  const data = new TextEncoder().encode(saltHex + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = toHex(hashBuffer);
  return saltHex + "$" + hashHex;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();

    if (!pin || pin.length < 4) {
      return new Response(
        JSON.stringify({ hash: null, error: "PIN must be at least 4 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hash = await hashPin(pin);

    return new Response(
      JSON.stringify({ hash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ hash: null, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
