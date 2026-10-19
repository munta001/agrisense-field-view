import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors">;
type Reading = Tables<"sensor_readings">;

const METRICS = [
  { key: "temperature_c", label: "Temperature", unit: "°C", color: "hsl(0, 72%, 51%)" },
  { key: "moisture_pct", label: "Soil Moisture", unit: "%", color: "hsl(200, 70%, 50%)" },
  { key: "conductivity", label: "Conductivity", unit: "µS/cm", color: "hsl(38, 90%, 55%)" },
  { key: "ph", label: "pH", unit: "", color: "hsl(270, 50%, 55%)" },
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg", color: "hsl(152, 55%, 35%)" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg", color: "hsl(96, 45%, 40%)" },
  { key: "potassium", label: "Potassium", unit: "mg/kg", color: "hsl(20, 70%, 50%)" },
  { key: "salinity", label: "Salinity", unit: "ppm", color: "hsl(190, 60%, 40%)" },
] as const;

const RANGES = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
];

export default function AnalyticsPage() {
  const { currentOrg } = useOrg();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorId, setSensorId] = useState("");
  const [range, setRange] = useState("7d");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("sensors").select("*").eq("org_id", currentOrg.id).order("device_id").then(({ data }) => {
      const list = data || [];
      setSensors(list);
      setSensorId(prev => prev || list[0]?.id || "");
      if (!list.length) setLoading(false);
    });
  }, [currentOrg]);

  useEffect(() => {
    if (!sensorId) return;
    const hours = RANGES.find(r => r.key === range)?.hours ?? 168;
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    setLoading(true);
    supabase
      .from("sensor_readings")
      .select("*")
      .eq("sensor_id", sensorId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(2000)
      .then(({ data }) => { setReadings(data || []); setLoading(false); });
  }, [sensorId, range]);

  const chartData = useMemo(
    () => readings.map(r => ({
      ...r,
      t: format(new Date(r.recorded_at), range === "24h" ? "HH:mm" : "dd MMM HH:mm"),
    })),
    [readings, range]
  );

  const stat = (key: string) => {
    const vals = readings.map(r => r[key as keyof Reading] as number | null).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return {
      last: vals[vals.length - 1],
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    };
  };

  const selected = sensors.find(s => s.id === sensorId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            8-in-1 soil probe analysis {selected ? `for ${selected.name}` : `for ${currentOrg?.name ?? ""}`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Select value={sensorId} onValueChange={setSensorId}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Select device" /></SelectTrigger>
            <SelectContent>
              {sensors.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.device_id != null ? ` (#${s.device_id})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[340px]" />)}
        </div>
      ) : !sensors.length ? (
        <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">No devices registered yet</CardContent></Card>
      ) : !readings.length ? (
        <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">No readings for this device in the selected period</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-4">
            {METRICS.map(m => {
              const s = stat(m.key);
              return (
                <Card key={m.key} className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{m.label}{m.unit ? ` (${m.unit})` : ""}</p>
                    <p className="break-words font-mono text-xl font-semibold" style={{ color: m.color }}>
                      {s ? s.last.toFixed(2) : "—"}
                    </p>
                    {s && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        avg {s.avg.toFixed(1)} · min {s.min} · max {s.max}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {METRICS.map((m, i) => (
              <Card key={m.key} className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg">{m.label}{m.unit ? ` (${m.unit})` : ""}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    {i % 2 === 0 ? (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`g-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={m.color} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Area type="monotone" dataKey={m.key} stroke={m.color} fill={`url(#g-${m.key})`} name={m.label} />
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
