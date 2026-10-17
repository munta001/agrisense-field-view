import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";
const TEMPLATE = "thirdeye_field_alert";
const UUID = /^[0-9a-f-]{36}$/i;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Meta rejects template params with newlines/tabs or 4+ spaces; also cap length.
const clean = (s: string | null | undefined, max = 200) =>
  (s || "-").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, " ").trim().slice(0, max) || "-";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const WHATSAPP_API_KEY = Deno.env.get("WHATSAPP_API_KEY");
    if (!LOVABLE_API_KEY || !WHATSAPP_API_KEY) return json({ error: "WhatsApp not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const alertId = body?.alert_id;
    if (typeof alertId !== "string" || !UUID.test(alertId)) return json({ error: "alert_id required" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Claim the alert once: only real, unsent, warning/critical alerts are processed.
    const { data: claimed } = await db.from("alerts")
      .update({ whatsapp_sent_at: new Date().toISOString() })
      .eq("id", alertId).is("whatsapp_sent_at", null).in("severity", ["warning", "critical"])
      .select("id, org_id, title, message").maybeSingle();
    if (!claimed) return json({ skipped: true });

    const { data: org } = await db.from("organizations").select("name").eq("id", claimed.org_id).maybeSingle();
    const { data: admins } = await db.from("user_roles")
      .select("user_id").eq("org_id", claimed.org_id).eq("role", "admin").eq("is_active", true);
    const ids = (admins || []).map((a: any) => a.user_id);
    if (!ids.length) return json({ sent: 0 });
    const { data: profiles } = await db.from("profiles").select("user_id, phone_number").in("user_id", ids);

    const phones = [...new Set((profiles || [])
      .map((p: any) => (p.phone_number || "").replace(/\D/g, ""))
      .filter((d: string) => d.length >= 8 && d.length <= 15))];

    const results = [];
    for (const to of phones) {
      const res = await fetch(`${GATEWAY_URL}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": WHATSAPP_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: TEMPLATE,
            language: { code: "en" },
            components: [{
              type: "body",
              parameters: [
                { type: "text", text: clean(org?.name, 60) },
                { type: "text", text: clean(claimed.title, 100) },
                { type: "text", text: clean(claimed.message, 300) },
              ],
            }],
          },
        }),
      });
      const text = await res.text();
      if (!res.ok) console.error(`WhatsApp send failed [${res.status}]: ${text}`);
      results.push({ ok: res.ok, status: res.status });
    }
    return json({ sent: results.filter((r) => r.ok).length, results });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
