import { supabase } from "@/integrations/supabase/client";

export const ALERT_PAGE_SIZE = 100;
export type AlertFeedFilters = { orgId: string; unreadOnly: boolean; sensorIds?: string[] };

export async function fetchAlertPage(filters: AlertFeedFilters, page = 0) {
  if (filters.sensorIds?.length === 0) return { alerts: [], count: 0 };
  let query = supabase.from("alerts").select("*", { count: "exact" })
    .eq("org_id", filters.orgId);
  if (filters.unreadOnly) query = query.eq("is_read", false);
  if (filters.sensorIds) query = query.in("sensor_id", filters.sensorIds);
  const size = filters.unreadOnly ? ALERT_PAGE_SIZE : 20;
  const { data, error, count } = await query.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(page * size, (page + 1) * size - 1);
  if (error) throw error;
  return { alerts: data ?? [], count: count ?? 0 };
}