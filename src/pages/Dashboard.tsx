import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, ArrowRight, CheckCircle2, Map, Radio, Sprout, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors">;
type Alert = Tables<"alerts">;
type Zone = Tables<"zones">;
type Crop = Tables<"crops">;
type CropStage = Tables<"crop_stages">;

type ZoneHealth = Zone & {
  cropName: string;
  stageName: string;
  activeDevices: number;
  onlineDevices: number;
  exceptions: number;
  latestActivity: string | null;
  status: "attention" | "offline" | "healthy" | "unmonitored";
};

const statusLabel = {
  attention: "Attention",
  offline: "Offline",
  healthy: "Healthy",
  unmonitored: "Unmonitored",
} as const;

export default function DashboardPage() {
  const { currentOrg } = useOrg();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [stages, setStages] = useState<CropStage[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [latestBySensor, setLatestBySensor] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;

    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [sensorResult, zoneResult, cropResult, alertResult] = await Promise.all([
        supabase.from("sensors").select("*").eq("org_id", currentOrg.id).eq("is_active", true).order("name"),
        supabase.from("zones").select("*").eq("org_id", currentOrg.id).order("name"),
        supabase.from("crops").select("*").eq("org_id", currentOrg.id).order("name"),
        supabase.from("alerts").select("*").eq("org_id", currentOrg.id).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
      ]);

      const sensorList = sensorResult.data || [];
      const cropIds = [...new Set((zoneResult.data || []).map(zone => zone.crop_id).filter((id): id is string => Boolean(id)))];
      const stageResult = cropIds.length
        ? await supabase.from("crop_stages").select("*").in("crop_id", cropIds).order("stage_order")
        : { data: [] as CropStage[] };
      const sensorIds = sensorList.map(sensor => sensor.id);
      const readingResult = sensorIds.length
        ? await supabase
            .from("sensor_readings")
            .select("sensor_id, recorded_at")
            .in("sensor_id", sensorIds)
            .gte("recorded_at", since)
            .order("recorded_at", { ascending: false })
            .limit(2000)
        : { data: [] as { sensor_id: string | null; recorded_at: string }[] };

      if (!active) return;
      const latest: Record<string, string> = {};
      for (const reading of readingResult.data || []) {
        if (reading.sensor_id && !latest[reading.sensor_id]) latest[reading.sensor_id] = reading.recorded_at;
      }

      setSensors(sensorList);
      setZones(zoneResult.data || []);
      setCrops(cropResult.data || []);
      setStages(stageResult.data || []);
      setAlerts(alertResult.data || []);
      setLatestBySensor(latest);
      setLoading(false);
    };

    loadDashboard();
    return () => { active = false; };
  }, [currentOrg?.id]);

  const zoneHealth = useMemo<ZoneHealth[]>(() => {
    return zones.map(zone => {
      const zoneSensors = sensors.filter(sensor => sensor.zone_id === zone.id);
      const sensorIds = new Set(zoneSensors.map(sensor => sensor.id));
      const zoneAlerts = alerts.filter(alert => alert.sensor_id && sensorIds.has(alert.sensor_id) && !alert.is_read);
      const activity = zoneSensors
        .map(sensor => latestBySensor[sensor.id])
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;
      const onlineDevices = zoneSensors.filter(sensor => sensor.status === "online").length;
      const status: ZoneHealth["status"] = zoneAlerts.length
        ? "attention"
        : zoneSensors.length > 0 && onlineDevices === 0
          ? "offline"
          : zoneSensors.length > 0
            ? "healthy"
            : "unmonitored";

      return {
        ...zone,
        cropName: crops.find(crop => crop.id === zone.crop_id)?.name || "Not assigned",
        stageName: stages.find(stage => stage.id === zone.crop_stage_id)?.name || "Not set",
        activeDevices: zoneSensors.length,
        onlineDevices,
        exceptions: zoneAlerts.length,
        latestActivity: activity,
        status,
      };
    }).sort((a, b) => {
      const priority = { attention: 0, offline: 1, unmonitored: 2, healthy: 3 };
      return priority[a.status] - priority[b.status] || a.name.localeCompare(b.name);
    });
  }, [alerts, crops, latestBySensor, sensors, stages, zones]);

  const online = sensors.filter(sensor => sensor.status === "online").length;
  const offline = sensors.length - online;
  const unreadExceptions = alerts.filter(alert => !alert.is_read).length;
  const zonesNeedingAttention = zoneHealth.filter(zone => zone.status === "attention" || zone.status === "offline").length;
  const exceptionAlerts = alerts.filter(alert => !alert.is_read).slice(0, 4);

  const exceptionTrend = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 8 }, (_, index) => {
      const end = new Date(now.getTime() - (7 - index) * 3 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 3 * 60 * 60 * 1000);
      return { start, end, label: format(end, "HH:mm"), critical: 0, warning: 0 };
    });

    for (const alert of alerts) {
      const created = new Date(alert.created_at);
      const bucket = buckets.find(item => created > item.start && created <= item.end);
      if (!bucket) continue;
      if (alert.severity === "critical" || alert.severity === "high") bucket.critical += 1;
      else bucket.warning += 1;
    }
    return buckets.map(({ label, critical, warning }) => ({ label, critical, warning }));
  }, [alerts]);

  const zoneExceptionData = useMemo(
    () => zoneHealth
      .filter(zone => zone.exceptions > 0)
      .slice(0, 6)
      .map(zone => ({ name: zone.name, exceptions: zone.exceptions })),
    [zoneHealth],
  );

  const stats = [
    { label: "Active devices", value: sensors.length, detail: `${online} online`, icon: Radio, tone: "text-primary bg-primary/10" },
    { label: "Operational zones", value: zones.length, detail: `${Math.max(zones.length - zonesNeedingAttention, 0)} healthy`, icon: Map, tone: "text-success bg-success/10" },
    { label: "Needs attention", value: zonesNeedingAttention, detail: `${unreadExceptions} exceptions`, icon: AlertTriangle, tone: "text-warning bg-warning/10" },
    { label: "Offline devices", value: offline, detail: offline ? "Check connectivity" : "All connected", icon: WifiOff, tone: "text-destructive bg-destructive/10" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-9 w-72" /><Skeleton className="h-5 w-52" /></div>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}</div>
        <Skeleton className="h-72" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-primary">Organisation overview</p>
          <h1 className="font-display text-3xl font-bold text-foreground">Farm Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live status and threshold exceptions from the last 24 hours</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/field-map"><Map className="mr-2 h-4 w-4" />Field map</Link></Button>
          <Button asChild><Link to="/alerts"><AlertTriangle className="mr-2 h-4 w-4" />View alerts</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.label} className="border-border shadow-sm">
            <CardContent className="p-3 sm:p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.tone}`}><stat.icon className="h-5 w-5" /></div>
                <span className="text-xs font-medium text-muted-foreground">Last 24h</span>
              </div>
              <p className="text-xs font-bold uppercase text-muted-foreground">{stat.label}</p>
              <div className="mt-1 flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <p className="font-display text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="pb-1 text-xs font-medium text-muted-foreground">{stat.detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-foreground">Exception trend</h2>
            <p className="text-xs text-muted-foreground">Critical and warning events across the organisation</p>
          </div>
          <div className="h-[260px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={exceptionTrend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="criticalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="warningFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="warning" name="Warnings" stroke="hsl(var(--warning))" fill="url(#warningFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="critical" name="Critical" stroke="hsl(var(--destructive))" fill="url(#criticalFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-foreground">Exceptions by zone</h2>
            <p className="text-xs text-muted-foreground">Unread threshold exceptions requiring attention</p>
          </div>
          <div className="h-[260px] p-4">
            {zoneExceptionData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneExceptionData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="exceptions" name="Exceptions" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-3 h-8 w-8 text-success" />
                <p className="text-sm font-semibold text-foreground">No zone exceptions</p>
                <p className="mt-1 text-xs text-muted-foreground">All monitored values are within range</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Zone health</h2>
            <p className="text-sm text-muted-foreground">Zones requiring action are shown first</p>
          </div>
          <Badge variant={zonesNeedingAttention ? "destructive" : "secondary"}>
            {zonesNeedingAttention ? `${zonesNeedingAttention} need attention` : "All zones healthy"}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Crop & stage</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Exceptions</TableHead>
                <TableHead>Latest activity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zoneHealth.length ? zoneHealth.map(zone => (
                <TableRow key={zone.id} className="group">
                  <TableCell>
                    <Link to="/field-map" className="flex items-center gap-3 font-semibold text-foreground hover:text-primary">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Map className="h-4 w-4" /></span>
                      {zone.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{zone.cropName}</p>
                    <p className="text-xs text-muted-foreground">{zone.stageName}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{zone.onlineDevices} / {zone.activeDevices} online</p>
                    <p className="text-xs text-muted-foreground">Active devices</p>
                  </TableCell>
                  <TableCell>
                    <span className={zone.exceptions ? "font-semibold text-destructive" : "text-muted-foreground"}>{zone.exceptions}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {zone.latestActivity ? formatDistanceToNow(new Date(zone.latestActivity), { addSuffix: true }) : "No readings in 24h"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={zone.status === "attention" || zone.status === "offline" ? "destructive" : zone.status === "healthy" ? "secondary" : "outline"}>
                      {zone.status === "healthy" && <CheckCircle2 className="mr-1 h-3 w-3" />}{statusLabel[zone.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No zones have been created yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Threshold exceptions</h2>
            <p className="text-sm text-muted-foreground">Only readings outside the active crop-stage range</p>
          </div>
          <Button variant="ghost" size="sm" asChild><Link to="/alerts">View all<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        {exceptionAlerts.length ? (
          <div className="divide-y divide-border">
            {exceptionAlerts.map(alert => (
              <div key={alert.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity === "critical" || alert.severity === "high" ? "bg-destructive" : "bg-warning"}`} />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-foreground">{alert.title}</p>
                    {alert.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{alert.message}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-5 sm:pl-0">
                  <Badge variant={alert.severity === "critical" || alert.severity === "high" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                  <span className="w-28 text-right text-xs text-muted-foreground">{format(new Date(alert.created_at), "dd MMM HH:mm")}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
            <Sprout className="h-5 w-5 text-success" /> No threshold exceptions in the last 24 hours
          </div>
        )}
      </section>
    </div>
  );
}