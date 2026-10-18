import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";

export function useAlertNotifications() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const orgId = currentOrg?.id;
  const queryKey = ["unread-alerts", orgId];
  const query = useQuery({
    queryKey, enabled: !!orgId, refetchInterval: 15000,
    queryFn: async () => {
      const { count, error } = await supabase.from("alerts").select("id", { count: "exact", head: true }).eq("org_id", orgId ?? "").eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!orgId) return;
    // Consumers share the query, but each effect needs its own channel. The
    // realtime client reuses channels by name, including during async teardown.
    const channel = supabase.channel(`alert-notifications-${orgId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `org_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["unread-alerts", orgId] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);
  return { unreadCount: query.data ?? 0, refreshNotifications: () => queryClient.invalidateQueries({ queryKey }) };
}