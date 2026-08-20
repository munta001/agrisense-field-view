import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Battery, Radio, MapPin, Thermometer, Droplets, Zap, FlaskConical, Leaf, Sprout, Beaker, Waves } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors"> & {
  sensor_types?: Tables<"sensor_types"> | null;
  zones?: Tables<"zones"> | null;
};
type Reading = Tables<"sensor_readings">;

const metrics = [
  { key: "temperature_c", label: "Temperature", unit: "°C", icon: Thermometer, color: "hsl(0, 72%, 51%)" },
  { key: "moisture_pct", label: "Moisture", unit: "%", icon: Droplets, color: "hsl(200, 70%, 50%)" },
  { key: "conductivity", label: "Conductivity", unit: "µS/cm", icon: Zap, color: "hsl(45, 90%, 50%)" },
  { key: "ph", label: "pH", unit: "pH", icon: FlaskConical, color: "hsl(280, 60%, 60%)" },
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg", icon: Leaf, color: "hsl(142, 60%, 45%)" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg", icon: Sprout, color: "hsl(25, 80%, 55%)" },
  { key: "potassium", label: "Potassium", unit: "mg/kg", icon: Beaker, color: "hsl(190, 70%, 45%)" },
  { key: "salinity", label: "Salinity", unit: "raw", icon: Waves, color: "hsl(220, 60%, 60%)" },
] as const;

export default function SensorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<string>("temperature_c");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from("sensors").select("*, sensor_types(*), zones(*)").eq("id", id).maybeSingle(),
        supabase.from("sensor_readings").select("*").eq("sensor_id", id).order("recorded_at", { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setSensor((s as Sensor) || null);
      setReadings((r || []).reverse());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const latest = readings[readings.length - 1];
  const chartData = readings.map(r => ({
    time: format(new Date(r.recorded_at), "dd/MM HH:mm"),
    value: r[activeMetric as keyof Reading] as number | null,
  }));
  const active = metrics.find(m => m.key === activeMetric)!;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!sensor) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/sensors")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <p className="text-muted-foreground">Sensor not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate("/sensors")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Sensors
          </Button>
          <h1 className="font-display text-2xl font-bold">{sensor.name}</h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Radio className="h-3.5 w-3.5" />Device ID {sensor.device_id ?? "—"}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{sensor.zones?.name || sensor.location || "No zone"}</span>
            {latest?.battery_v != null && (
              <span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" />{latest.battery_v} V</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sensor.status === "online" ? "default" : sensor.status === "offline" ? "destructive" : "secondary"}>
            {sensor.status}
          </Badge>
          {latest && (
            <span className="text-xs text-muted-foreground">
              Last uplink {format(new Date(latest.recorded_at), "dd MMM yyyy HH:mm")}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(m => {
          const v = latest ? (latest[m.key as keyof Reading] as number | null) : null;
          return (
            <Card
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`glass-card cursor-pointer transition-shadow hover:shadow-md ${activeMetric === m.key ? "ring-2 ring-primary" : ""}`}
            >
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                  <m.icon className="h-4 w-4" />
                  <span className="text-xs">{m.label}</span>
                </div>
                <p className="font-display text-2xl font-bold">
                  {v ?? "—"}<span className="ml-1 text-sm font-normal text-muted-foreground">{m.unit}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">{active.label} history</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No readings received from this device yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke={active.color} dot={false} name={`${active.label} (${active.unit})`} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {latest && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Last uplink details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-muted-foreground">Serial number</p><p className="font-mono">{latest.serial_number ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Channel</p><p className="font-mono">{latest.channel ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Packet type</p><p className="font-mono">{latest.packet_type ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Checksum</p><p className="font-mono">{latest.checksum_valid == null ? "—" : latest.checksum_valid ? "valid" : "invalid"}</p></div>
            <div><p className="text-muted-foreground">Battery</p><p className="font-mono">{latest.battery_v ?? "—"} V</p></div>
            <div><p className="text-muted-foreground">Report cycle</p><p className="font-mono">{latest.report_cycle_s ?? "—"} s</p></div>
            <div><p className="text-muted-foreground">Location</p><p className="font-mono">{sensor.location || "—"}</p></div>
            <div><p className="text-muted-foreground">IP address</p><p className="font-mono">{sensor.ip_address || "—"}</p></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
