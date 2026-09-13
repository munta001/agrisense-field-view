import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const { data: userData } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const { data: isAdmin } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!isAdmin) return json({ error: "Not authorised" }, 403);

    const body = await req.json();
    const action = body?.action as string;

    if (action === "list_users") {
      const [{ data: list }, { data: roles }, { data: profiles }, { data: orgs }] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("user_roles").select("user_id, org_id, role"),
        admin.from("profiles").select("user_id, full_name"),
        admin.from("organizations").select("id, name").order("name"),
      ]);

      const users = (list?.users ?? []).map((u) => {
        const memberships = (roles ?? [])
          .filter((x) => x.user_id === u.id)
          .map((x) => ({
            org_id: x.org_id,
            org_name: orgs?.find((o) => o.id === x.org_id)?.name ?? null,
            role: x.role,
          }))
          .sort((a, b) => (a.org_name ?? "").localeCompare(b.org_name ?? ""));
        const p = (profiles ?? []).find((x) => x.user_id === u.id);
        const bannedUntil = (u as unknown as { banned_until?: string }).banned_until;
        return {
          user_id: u.id,
          email: u.email ?? null,
          full_name: p?.full_name ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          memberships,
          is_active: !bannedUntil || new Date(bannedUntil).getTime() <= Date.now(),
        };
      });

      return json({ users, organizations: orgs ?? [] });
    }

    if (action === "create_org") {
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Organisation name is required" }, 400);
      const slug =
        String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { data, error } = await admin
        .from("organizations")
        .insert({ name, slug })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ organization: data });
    }

    if (action === "set_membership") {
      const userId = String(body.user_id);
      const orgId = String(body.org_id ?? "");
      const role = String(body.role ?? "viewer");
      if (!orgId) return json({ error: "Choose an organisation" }, 400);

      await admin.from("user_roles").delete().eq("user_id", userId).eq("org_id", orgId);
      const { error } = await admin.from("user_roles").insert({ user_id: userId, org_id: orgId, role });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "remove_membership") {
      const userId = String(body.user_id);
      const orgId = String(body.org_id ?? "");
      if (!orgId) return json({ error: "Choose an organisation" }, 400);
      const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("org_id", orgId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "set_user_active") {
      const userId = String(body.user_id);
      const active = Boolean(body.active);
      if (userId === caller.id) return json({ error: "You cannot deactivate your own account" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
