import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);
    const { data: u } = await admin.auth.getUser(token);
    const caller = u?.user;
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const body = await req.json();
    const userId = String(body?.user_id ?? "");
    const orgId = body?.org_id ? String(body.org_id) : null;
    const password = String(body?.new_password ?? "");
    if (!userId) return json({ error: "User is required" }, 400);
    if (password.length < 6 || password.length > 72) return json({ error: "Password must be 6–72 characters" }, 400);

    const isMaster = async (id: string) => {
      const { data } = await admin.from("user_roles").select("id")
        .eq("user_id", id).eq("role", "master_admin").eq("is_active", true).maybeSingle();
      return !!data;
    };

    if (!(await isMaster(caller.id))) {
      if (!orgId) return json({ error: "Not authorised" }, 403);
      const { data: callerRole } = await admin.from("user_roles").select("id")
        .eq("user_id", caller.id).eq("org_id", orgId).eq("role", "admin").eq("is_active", true).maybeSingle();
      if (!callerRole) return json({ error: "Not authorised" }, 403);
      const { data: target } = await admin.from("user_roles").select("id")
        .eq("user_id", userId).eq("org_id", orgId).maybeSingle();
      if (!target) return json({ error: "User is not in this organisation" }, 403);
      if (await isMaster(userId)) return json({ error: "Only a Master Admin can reset this account" }, 403);
    }

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
