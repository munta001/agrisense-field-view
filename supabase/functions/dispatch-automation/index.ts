import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMQX_API = Deno.env.get("EMQX_API_URL")!;
const EMQX_KEY = Deno.env.get("EMQX_API_KEY")!;
const EMQX_SECRET = Deno.env.get("EMQX_API_SECRET")!;
const DISPATCH_SECRET = Deno.env.get("DISPATCH_SECRET")!;
const STALE_MIN = 5; // an ON older than this is never sent

const hexToB64 = (hex: string) =>
  btoa(String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16))));

Deno.serve(async (req) => {
  if (req.headers.get("x-dispatch-secret") !== DISPATCH_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - STALE_MIN * 60000).toISOString();

  // never send a stale ON (an OFF is always safe to send late)
  await db.from("automation_commands").update({ status: "failed" })
    .eq("status", "pending").eq("command", "on").lt("execute_at", staleIso);

  const { data: due, error } = await db.from("automation_commands")
    .select("id, command, appliances(controller_dev_eui, do_channel)")
    .eq("status", "pending").lte("execute_at", nowIso)
    .order("execute_at").limit(20);
  if (error) return new Response(error.message, { status: 500 });

  const results: unknown[] = [];
  for (const c of due ?? []) {
    // claim the row so overlapping runs can't send it twice
    const { data: claimed } = await db.from("automation_commands")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", c.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;

    // deno-lint-ignore no-explicit-any
    const ap: any = Array.isArray(c.appliances) ? c.appliances[0] : c.appliances;
    let ok = false;
    let errMsg = "";
    try {
      const hex = ap.do_channel + (c.command === "on" ? "0100" : "0000") + "ff";
      const res = await fetch(`${EMQX_API}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(`${EMQX_KEY}:${EMQX_SECRET}`),
        },
        body: JSON.stringify({
          topic: `/milesight/downlink/${ap.controller_dev_eui}`,
          qos: 1,
          payload: JSON.stringify({ confirmed: true, fport: 85, data: hexToB64(hex) }),
        }),
      });
      ok = res.status === 200; // 202 = no matching subscriber (gateway offline)
      if (!ok) errMsg = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      errMsg = `fetch error: ${String(e).slice(0, 200)}`;
    }

    if (!ok) {
      // a failed OFF goes back to pending to be retried; a failed ON is dropped
      await db.from("automation_commands")
        .update(c.command === "off"
          ? { status: "pending", sent_at: null, error: errMsg }
          : { status: "failed", error: errMsg })
        .eq("id", c.id);
    }
    results.push({ id: c.id, command: c.command, ok });
  }
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
