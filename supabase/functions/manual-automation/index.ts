import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const schema = z.object({ appliance_id: z.string().uuid(), command: z.enum(["on", "off"]), alert_id: z.string().uuid().optional() });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const dispatchSecret = Deno.env.get("DISPATCH_SECRET");
  if (!url || !key || !dispatchSecret) return response({ error: "Controller service unavailable" }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return response({ error: "Sign in required" }, 401);
  const db = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) return response({ error: "Sign in required" }, 401);
  let input;
  try { input = schema.safeParse(await req.json()); } catch { return response({ error: "Invalid request" }, 400); }
  if (!input.success) return response({ error: "Invalid command or appliance" }, 400);
  const { appliance_id, command, alert_id } = input.data;
  const { data: commandId, error } = await db.rpc("request_manual_automation", { p_appliance_id: appliance_id, p_command: command, p_alert_id: alert_id ?? null });
  if (error) return response({ error: error.message }, 400);
  // Queue atomically first; the existing scheduled dispatcher retries if this call cannot reach it.
  try {
    await fetch(`${url}/functions/v1/dispatch-automation`, { method: "POST", headers: { "x-dispatch-secret": dispatchSecret }, signal: AbortSignal.timeout(10000) });
  } catch { /* No credentials or upstream responses are logged or returned. */ }
  const { data: result } = await db.from("automation_commands").select("status").eq("id", commandId).single();
  return response({ command_id: commandId, status: result?.status ?? "pending" });
});