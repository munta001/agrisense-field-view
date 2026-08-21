import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, AlertTriangle, Battery, Radio } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors">;
type Reading = Tables<"sensor_readings">;
type Alert = Tables<"alerts">;

const METRICS = [
  { key: "temperature_c", label: "Temperature", unit: "°C", color: "hsl(0, 72%, 51%)" },
  { key: "moisture_pct", label: "Soil Moisture", unit: "%", color: "hsl(200, 70%, 50%)" },
  { key: "conductivity", label: "Conductivity", unit: "µS/cm", color: "hsl(38, 90%, 55%)" },
  { key: "ph", label: "pH", unit: "", color: "hsl(270, 50%, 55%)" },
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg", color: "hsl(152, 55%, 35%)" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg", color: "hsl(96, 45%, 40%)" },
  { key: "potassium", label: "Potassium", unit: "mg/kg", color: "hsl(20, 70%, 50%)" },
  { key: "salinity", label: "Salinity", unit: "", color: "hsl(190, 60%, 40%)" },
] as const;

const severityVariant = (s: string) =>
  s === "critical" || s === "high" ? "destructive" : s === "medium" ? "default" : "secondary";

export default function DashboardPage() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorId, setSensorId] = useState("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingSensors, setLoadingSensors] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    setLoadingSensors(true);
    supabase.from("sensors").select("*").eq("org_id", currentOrg.id).order("device_id").then(({ data }) => {
      const list = data || [];
      setSensors(list);
      setSensorId(prev => prev || list[0]?.id || "");
      setLoadingSensors(false);
      if (!list.length) setLoadingReadings(false);
    });
    supabase
      .from("alerts")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setAlerts(data || []));
  }, [currentOrg]);

  useEffect(() => {
    if (!sensorId) return;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    setLoadingReadings(true);
    supabase
      .from("sensor_readings")
      .select("*")
      .eq("sensor_id", sensorId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(1000)
      .then(({ data }) => { setReadings(data || []); setLoadingReadings(false); });
  }, [sensorId]);

  const chartData = useMemo(
    () => readings.map(r => ({ ...r, t: format(new Date(r.recorded_at), "HH:mm") })),
    [readings]
  );

  const latest = readings[readings.length - 1];
  const selected = sensors.find(s => s.id === sensorId);
  const unreadAlerts = alerts.filter(a => !a.is_read).length;
  const online = sensors.filter(s => s.status === "online").length;

  const stats = [
    { title: "Devices", value: sensors.length, icon: Radio, color: "text-primary" },
    { title: "Online", value: online, icon: Activity, color: "text-success" },
    { title: "Offline", value: sensors.length - online, icon: Activity, color: "text-destructive" },
    { title: "Unread Alerts", value: unreadAlerts, icon: AlertTriangle, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Last 24 hours {selected ? `· ${selected.name}` : `· ${currentOrg?.name ?? ""}`}
          </p>
        </div>
        <Select value={sensorId} onValueChange={setSensorId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select device" /></SelectTrigger>
          <SelectContent>
            {sensors.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}{s.device_id != null ? ` (#${s.device_id})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.title} className="glass-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg p-2.5 bg-muted ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {alerts.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-lg">Recent alerts</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/alerts")}>View all</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.message && <p className="text-xs text-muted-foreground">{a.message}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={severityVariant(a.severity) as any}>{a.severity}</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(a.created_at), "dd MMM HH:mm")}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loadingSensors || loadingReadings ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[320px]" />)}
        </div>
      ) : !sensors.length ? (
        <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">No devices registered yet</CardContent></Card>
      ) : !readings.length ? (
        <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">No readings from this device in the last 24 hours</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {METRICS.map(m => {
              const v = latest ? (latest[m.key as keyof Reading] as number | null) : null;
              return (
                <Card key={m.key} className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{m.label}{m.unit ? ` (${m.unit})` : ""}</p>
                    <p className="font-mono text-xl font-semibold" style={{ color: m.color }}>
                      {v ?? "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {latest && (
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" />{latest.battery_v ?? "—"} V</span>
              <span>Last uplink {format(new Date(latest.recorded_at), "dd MMM HH:mm")}</span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {METRICS.map((m, i) => (
              <Card key={m.key} className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg">{m.label}{m.unit ? ` (${m.unit})` : ""}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    {i % 2 === 0 ? (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`dg-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={m.color} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Area type="monotone" dataKey={m.key} stroke={m.color} fill={`url(#dg-${m.key})`} name={m.label} />
                      </AreaChart>
                    ) : (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Line type="monotone" dataKey={m.key} stroke={m.color} dot={false} strokeWidth={2} name={m.label} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
