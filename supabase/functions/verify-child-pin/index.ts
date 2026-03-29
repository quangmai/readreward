// supabase/functions/verify-child-pin/index.ts
// Deploy: supabase functions deploy verify-child-pin --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  // storedHash format: saltHex$hashHex
  const parts = storedHash.split("$");
  if (parts.length !== 2) return false;
  const [saltHex, expectedHashHex] = parts;
  // Recompute: SHA-256(salt + pin)
  const data = new TextEncoder().encode(saltHex + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = toHex(hashBuffer);
  return hashHex === expectedHashHex;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { childId, pin } = await req.json();

    if (!childId || !pin) {
      return new Response(
        JSON.stringify({ valid: false, error: "childId and pin are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: child, error } = await supabaseAdmin
      .from("children")
      .select("pin_hash")
      .eq("id", childId)
      .single();

    if (error || !child) {
      return new Response(
        JSON.stringify({ valid: false, error: "Child not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valid = await verifyPin(pin, child.pin_hash);

    return new Response(
      JSON.stringify({ valid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
