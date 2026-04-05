import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

type Zone = Tables<"zones">;
type Sensor = Tables<"sensors"> & { sensor_types?: Tables<"sensor_types"> | null };

// Demo field boundaries for presentation
const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;

const demoZones: { name: string; color: string; x: number; y: number; w: number; h: number }[] = [
  { name: "Zone A", color: "#22c55e", x: 20, y: 20, w: 370, h: 220 },
  { name: "Zone B", color: "#3b82f6", x: 410, y: 20, w: 370, h: 220 },
  { name: "Zone C", color: "#f59e0b", x: 20, y: 260, w: 370, h: 220 },
  { name: "Zone D", color: "#ef4444", x: 410, y: 260, w: 370, h: 220 },
];

export default function FieldMapPage() {
  const { currentOrg } = useOrg();
  const [zones, setZones] = useState<Zone[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("all");

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("zones").select("*").eq("org_id", currentOrg.id).then(({ data }) => setZones(data || []));
    supabase.from("sensors").select("*, sensor_types(*)").eq("org_id", currentOrg.id).then(({ data }) => setSensors((data as Sensor[]) || []));
  }, [currentOrg]);

  // Use demo zones if no real zones exist
  const displayZones = zones.length > 0 ? zones : demoZones.map((z, i) => ({ ...z, id: `demo-${i}`, org_id: "", created_at: "", updated_at: "", boundaries: null }));

  // Generate demo sensor positions if sensors don't have map positions
  const sensorPositions = sensors.map((s, i) => ({
    ...s,
    displayX: s.map_x || (80 + (i % 5) * 150 + Math.random() * 40),
    displayY: s.map_y || (80 + Math.floor(i / 5) * 120 + Math.random() * 40),
  }));

  const filteredSensors = selectedZone === "all" ? sensorPositions : sensorPositions.filter(s => s.zone_id === selectedZone);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Field Map</h1>
          <p className="text-muted-foreground">2D view of sensor locations</p>
        </div>
        <Select value={selectedZone} onValueChange={setSelectedZone}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-4">
          <svg viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`} className="w-full h-auto rounded-lg" style={{ background: "hsl(var(--muted))" }}>
            {/* Grid lines */}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`vg-${i}`} x1={(i + 1) * 80} y1={0} x2={(i + 1) * 80} y2={FIELD_HEIGHT} stroke="hsl(var(--border))" strokeWidth={0.5} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <line key={`hg-${i}`} x1={0} y1={(i + 1) * 83} x2={FIELD_WIDTH} y2={(i + 1) * 83} stroke="hsl(var(--border))" strokeWidth={0.5} />
            ))}

            {/* Zones */}
            {demoZones.map((zone, i) => (
              <g key={i}>
                <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill={zone.color} fillOpacity={0.12} stroke={zone.color} strokeWidth={2} rx={8} />
                <text x={zone.x + 12} y={zone.y + 24} fill={zone.color} fontSize={14} fontWeight={600}>{zone.name}</text>
              </g>
            ))}

            {/* Sensors */}
            {filteredSensors.map(sensor => (
              <g key={sensor.id}>
                <circle cx={sensor.displayX} cy={sensor.displayY} r={14}
                  fill={sensor.status === "online" ? "hsl(var(--success))" : sensor.status === "offline" ? "hsl(var(--destructive))" : "hsl(var(--warning))"}
                  fillOpacity={0.2} stroke={sensor.status === "online" ? "hsl(var(--success))" : sensor.status === "offline" ? "hsl(var(--destructive))" : "hsl(var(--warning))"} strokeWidth={2}
                />
                <circle cx={sensor.displayX} cy={sensor.displayY} r={5}
                  fill={sensor.status === "online" ? "hsl(var(--success))" : sensor.status === "offline" ? "hsl(var(--destructive))" : "hsl(var(--warning))"}
                />
                <text x={sensor.displayX} y={sensor.displayY + 24} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={10} fontWeight={500}>
                  {sensor.name}
                </text>
              </g>
            ))}

            {filteredSensors.length === 0 && (
              <text x={FIELD_WIDTH / 2} y={FIELD_HEIGHT / 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={16}>
                No sensors to display. Add sensors first.
              </text>
            )}
          </svg>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {demoZones.map(z => (
          <div key={z.name} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: z.color }} />
            <span className="text-sm text-muted-foreground">{z.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-4">
          <div className="h-3 w-3 rounded-full bg-success" /><span className="text-sm text-muted-foreground">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-destructive" /><span className="text-sm text-muted-foreground">Offline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-warning" /><span className="text-sm text-muted-foreground">Maintenance</span>
        </div>
      </div>
    </div>
  );
}
