import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, AlertTriangle, Info, AlertOctagon, Check, CheckCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fetchAlertPage } from "@/lib/alert-feed";
import { useToast } from "@/hooks/use-toast";

const severityConfig = {
  critical: { icon: AlertOctagon, color: "text-destructive", bg: "bg-destructive/10", border: "border-l-destructive", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-l-warning", badge: "secondary" as const },
  info: { icon: Info, color: "text-info", bg: "bg-info/10", border: "border-l-info", badge: "default" as const },
};

export default function AlertsPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = currentOrg?.id;
  const [view, setView] = useState("unread");
  const [zoneId, setZoneId] = useState("all");
  const [sensorId, setSensorId] = useState("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  useEffect(() => { setZoneId("all"); setSensorId("all"); }, [orgId]);

  const options = useQuery({
    queryKey: ["alert-filter-options", user?.id, orgId], enabled: Boolean(orgId && user),
    queryFn: async () => {
      if (!orgId) return { sensors: [], zones: [] };
      const [sensors, zones] = await Promise.all([
        supabase.from("sensors").select("id,name,zone_id").eq("org_id", orgId).order("name"),
        supabase.from("zones").select("id,name").eq("org_id", orgId).order("name"),
      ]);
      if (sensors.error) throw sensors.error;
      if (zones.error) throw zones.error;
      return { sensors: sensors.data ?? [], zones: zones.data ?? [] };
    },
  });
  const sensors = (options.data?.sensors ?? []).filter(s => zoneId === "all" || s.zone_id === zoneId);
  const feed = useInfiniteQuery({
    queryKey: ["alert-feed", user?.id, orgId, view, zoneId, sensorId, options.data],
    enabled: Boolean(orgId && user && options.data), initialPageParam: 0,
    refetchInterval: 15000,
    queryFn: ({ pageParam }) => fetchAlertPage({
      orgId: orgId ?? "", unreadOnly: view === "unread",
      sensorIds: sensorId !== "all" ? [sensorId] : zoneId !== "all" ? sensors.map(s => s.id) : undefined,
    }, pageParam),
    getNextPageParam: (lastPage, pages) => view === "unread" && pages.reduce((n, p) => n + p.alerts.length, 0) < lastPage.count ? pages.length : undefined,
  });
  const alerts = feed.data?.pages.flatMap(p => p.alerts) ?? [];
  const count = feed.data?.pages[0]?.count ?? 0;
  const loading = options.isPending || feed.isPending;
  const failed = options.isError || feed.isError;
  const markRead = async (id: string) => {
    if (!orgId) return;
    setMarkingId(id);
    try {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("org_id", orgId).eq("id", id);
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alert-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["alert-notifications"] }),
      ]);
    } catch { toast({ title: "Could not mark alert as read", variant: "destructive" }); }
    finally { setMarkingId(null); }
  };

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="break-words font-display text-2xl font-bold">Alerts & Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">{loading ? "Loading alerts…" : view === "unread" ? `${count} unread alerts` : "20 most recent alerts"}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <Tabs value={view} onValueChange={setView}>
          <TabsList aria-label="Alert view"><TabsTrigger value="unread">Unread</TabsTrigger><TabsTrigger value="recent">Recent</TabsTrigger></TabsList>
        </Tabs>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:w-[32rem]">
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="alert-zone">Zone</label>
            <Select value={zoneId} onValueChange={id => { setZoneId(id); setSensorId("all"); }}>
              <SelectTrigger id="alert-zone" aria-label="Filter by zone"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All zones</SelectItem>{options.data?.zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="alert-sensor">Sensor</label>
            <Select value={sensorId} onValueChange={setSensorId}>
              <SelectTrigger id="alert-sensor" aria-label="Filter by sensor"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All sensors</SelectItem>{sensors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="space-y-3" aria-live="polite">
        {failed ? <div className="py-8 text-center"><p className="text-muted-foreground">Couldn't load alerts.</p><Button variant="outline" className="mt-3" onClick={() => { void options.refetch(); void feed.refetch(); }}>Retry</Button></div> :
          loading ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />) : alerts.map(alert => {
            const config = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig.info;
            const Icon = config.icon;
            const sensor = options.data?.sensors.find(s => s.id === alert.sensor_id);
            const zone = options.data?.zones.find(z => z.id === sensor?.zone_id);
            return <Card key={alert.id} className={alert.is_read ? "bg-muted/40" : `border-l-4 ${config.border}`}>
              <CardContent className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                <div className={`shrink-0 rounded-md p-2 ${config.bg}`}><Icon className={`h-5 w-5 ${config.color}`} /></div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-start gap-2"><h2 className="min-w-0 break-words text-sm font-semibold sm:text-base">{alert.title}</h2><Badge variant={config.badge} className="shrink-0">{alert.severity}</Badge></div>
                  <p className="break-words text-sm leading-relaxed text-muted-foreground">{alert.message}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{sensor && <span className="break-words">{sensor.name}</span>}{zone && <span className="break-words">{zone.name}</span>}<time dateTime={alert.created_at}>{format(new Date(alert.created_at), "dd MMM yyyy HH:mm")}</time></div>
                </div>
                {!alert.is_read && <Button variant="ghost" size="icon" className="shrink-0" title="Mark as read" aria-label="Mark alert as read" disabled={markingId !== null} onClick={() => void markRead(alert.id)}>{markingId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button>}
              </CardContent>
            </Card>;
          })}
        {!loading && !failed && alerts.length === 0 && <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><Bell className="h-10 w-10 opacity-40" /><p>{view === "unread" ? "No unread alerts" : "No alerts"}{zoneId !== "all" || sensorId !== "all" ? " matching these filters" : ""}</p></div>}
      </div>
      {feed.hasNextPage && <div className="flex flex-col items-center gap-2 py-3"><p className="text-xs text-muted-foreground">{alerts.length} of {count} unread alerts</p><Button variant="outline" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load more alerts</Button></div>}
    </div>
  );
}