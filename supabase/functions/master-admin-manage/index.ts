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
      .from("user_roles")
      .select("id")
      .eq("user_id", caller.id)
      .eq("role", "master_admin")
      .eq("is_active", true)
      .maybeSingle();
    if (!isAdmin) return json({ error: "Not authorised" }, 403);

    const body = await req.json();
    const action = body?.action as string;

    if (action === "list_users") {
      const [{ data: list }, { data: roles }, { data: profiles }, { data: orgs }] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("user_roles").select("user_id, org_id, role, is_active").not("org_id", "is", null),
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
            is_active: (x as { is_active?: boolean }).is_active !== false,
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

      // Optional logo upload: base64-encoded image stored in the public zone-images bucket
      const logoBase64 = body.logo_base64 ? String(body.logo_base64) : null;
      if (logoBase64) {
        try {
          const contentType = String(body.logo_content_type ?? "image/png");
          const ext = (contentType.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "png";
          const bytes = Uint8Array.from(atob(logoBase64), (c) => c.charCodeAt(0));
          const path = `${data.id}/logo-${Date.now()}.${ext}`;
          const { error: upErr } = await admin.storage
            .from("zone-images")
            .upload(path, bytes, { contentType, upsert: true });
          if (upErr) {
            console.error("Logo upload failed:", upErr.message);
          } else {
            const { data: pub } = admin.storage.from("zone-images").getPublicUrl(path);
            await admin.from("organizations").update({ logo_url: pub.publicUrl }).eq("id", data.id);
            data.logo_url = pub.publicUrl;
          }
        } catch (e) {
          console.error("Logo upload error:", e);
        }
      }

      return json({ organization: data });
    }

    if (action === "update_org") {
      const orgId = String(body.org_id ?? "");
      const name = String(body.name ?? "").trim();
      const slug = String(body.slug ?? "").trim().toLowerCase();
      if (!orgId) return json({ error: "Organisation is required" }, 400);
      if (!name || !slug) return json({ error: "Name and slug are required" }, 400);

      const { error } = await admin.from("organizations").update({ name, slug }).eq("id", orgId);
      if (error) return json({ error: error.message }, 400);

      // Optional logo upload
      const logoBase64 = typeof body.logo_base64 === "string" ? body.logo_base64 : "";
      if (logoBase64) {
        const contentType = String(body.logo_content_type ?? "image/png");
        const ext = contentType.includes("svg") ? "svg" : contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1] ?? "png";
        const path = `${orgId}/logo-${Date.now()}.${ext}`;
        const bytes = Uint8Array.from(atob(logoBase64), (c) => c.charCodeAt(0));
        const { error: upErr } = await admin.storage.from("zone-images").upload(path, bytes, { contentType, upsert: true });
        if (upErr) return json({ error: upErr.message }, 400);
        const { data: pub } = admin.storage.from("zone-images").getPublicUrl(path);
        await admin.from("organizations").update({ logo_url: pub.publicUrl }).eq("id", orgId);
      }
      return json({ success: true });
    }

    if (action === "set_org_active") {
      const orgId = String(body.org_id ?? "");
      if (!orgId) return json({ error: "Organisation is required" }, 400);
      const { error } = await admin.from("organizations").update({ is_active: Boolean(body.active) }).eq("id", orgId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
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

    if (action === "set_membership_active") {
      const userId = String(body.user_id);
      const orgId = String(body.org_id ?? "");
      if (!orgId) return json({ error: "Choose an organisation" }, 400);
      const { error } = await admin
        .from("user_roles")
        .update({ is_active: Boolean(body.active) })
        .eq("user_id", userId)
        .eq("org_id", orgId);
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

    if (action === "list_master_admins") {
      const [{ data: admins }, { data: list }, { data: profiles }, { data: roles }, { data: orgs }] =
        await Promise.all([
          admin.from("user_roles").select("user_id, created_at").eq("role", "master_admin"),
          admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
          admin.from("profiles").select("user_id, full_name"),
          admin.from("user_roles").select("user_id, org_id, role").not("org_id", "is", null),
          admin.from("organizations").select("id, name"),
        ]);

      const result = (admins ?? []).map((a) => {
        const u = (list?.users ?? []).find((x) => x.id === a.user_id);
        const p = (profiles ?? []).find((x) => x.user_id === a.user_id);
        const bannedUntil = (u as unknown as { banned_until?: string } | undefined)?.banned_until;
        return {
          user_id: a.user_id,
          granted_at: a.created_at,
          email: u?.email ?? null,
          full_name: p?.full_name ?? null,
          created_at: u?.created_at ?? null,
          last_sign_in_at: u?.last_sign_in_at ?? null,
          email_confirmed_at: (u as unknown as { email_confirmed_at?: string } | undefined)?.email_confirmed_at ?? null,
          provider: (u?.app_metadata as { provider?: string } | undefined)?.provider ?? "email",
          is_active: !bannedUntil || new Date(bannedUntil).getTime() <= Date.now(),
          is_self: a.user_id === caller.id,
          memberships: (roles ?? [])
            .filter((r) => r.user_id === a.user_id)
            .map((r) => ({
              org_id: r.org_id,
              org_name: orgs?.find((o) => o.id === r.org_id)?.name ?? null,
              role: r.role,
            })),
        };
      });

      result.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
      return json({ admins: result });
    }

    if (action === "create_master_admin") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const password = String(body.password ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
      if (password && password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
      let emailed = false;

      if (!user) {
        if (password) {
          const { data: created, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: fullName ? { full_name: fullName } : undefined,
          });
          if (error) return json({ error: error.message }, 400);
          user = created.user!;
        } else {
          const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
            data: fullName ? { full_name: fullName } : undefined,
          });
          if (error) return json({ error: error.message }, 400);
          user = invited.user!;
          emailed = true;
        }
      }

      const { data: already } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "master_admin")
        .maybeSingle();
      if (already) return json({ error: "This person is already a master admin" }, 400);

      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: user.id, org_id: null, role: "master_admin" });
      if (insErr) return json({ error: insErr.message }, 400);

      if (fullName) {
        await admin.from("profiles").upsert(
          { user_id: user.id, full_name: fullName },
          { onConflict: "user_id" },
        );
      }

      // Notify the new master admin by email (invite already contains a link)
      if (!emailed) {
        const { error: mailErr } = await admin.auth.resetPasswordForEmail(email);
        if (!mailErr) emailed = true;
        else console.error("Notification email failed:", mailErr.message);
      }

      return json({ success: true, user_id: user.id, emailed });
    }

    if (action === "remove_master_admin") {
      const userId = String(body.user_id ?? "");
      if (!userId) return json({ error: "User is required" }, 400);
      if (userId === caller.id) return json({ error: "You cannot remove your own master admin access" }, 400);
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "master_admin");
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
