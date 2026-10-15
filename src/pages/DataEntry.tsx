import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors">;
type Reading = Tables<"sensor_readings">;

const FIELDS = [
  { key: "temperature_c", label: "Temperature", unit: "°C", step: "0.1" },
  { key: "moisture_pct", label: "Moisture", unit: "%", step: "0.1" },
  { key: "conductivity", label: "Conductivity", unit: "µS/cm", step: "1" },
  { key: "ph", label: "pH", unit: "", step: "0.01" },
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg", step: "1" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg", step: "1" },
  { key: "potassium", label: "Potassium", unit: "mg/kg", step: "1" },
  { key: "salinity", label: "Salinity", unit: "ppm", step: "1" },
] as const;

const emptyForm = () => Object.fromEntries(FIELDS.map(f => [f.key, ""])) as Record<string, string>;

export default function DataEntryPage() {
  const { currentOrg, currentRole } = useOrg();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [sensorId, setSensorId] = useState("");
  const [values, setValues] = useState<Record<string, string>>(emptyForm());
  const [battery, setBattery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { toast } = useToast();
  const canEdit = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchAll = async () => {
    if (!currentOrg) return;
    setFetching(true);
    const { data: s } = await supabase.from("sensors").select("*").eq("org_id", currentOrg.id).order("device_id");
    const list = s || [];
    setSensors(list);
    if (list.length) {
      const { data: r } = await supabase
        .from("sensor_readings")
        .select("*")
        .in("sensor_id", list.map(x => x.id))
        .order("recorded_at", { ascending: false })
        .limit(50);
      setReadings(r || []);
    } else setReadings([]);
    setFetching(false);
  };

  useEffect(() => { fetchAll(); }, [currentOrg]);

  const sensorName = (id: string | null) => sensors.find(s => s.id === id)?.name || "—";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensorId) { toast({ title: "Select a device", variant: "destructive" }); return; }
    setLoading(true);
    const sensor = sensors.find(s => s.id === sensorId);
    const payload: Record<string, unknown> = {
      sensor_id: sensorId,
      device_id: sensor?.device_id ?? null,
      recorded_at: new Date().toISOString(),
      battery_v: battery ? parseFloat(battery) : null,
      checksum_valid: true,
    };
    FIELDS.forEach(f => { payload[f.key] = values[f.key] !== "" ? parseFloat(values[f.key]) : null; });

    const { error } = await supabase.from("sensor_readings").insert(payload as never);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Reading recorded" });
      setValues(emptyForm());
      setBattery("");
      fetchAll();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Data Entry</h1>
        <p className="text-muted-foreground">Record a full 8-in-1 soil probe reading manually</p>
      </div>

      {canEdit && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Add Manual Reading</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Device</Label>
                  <Select value={sensorId} onValueChange={setSensorId}>
                    <SelectTrigger><SelectValue placeholder="Select LoRaWAN device" /></SelectTrigger>
                    <SelectContent>
                      {sensors.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.device_id != null ? ` (#${s.device_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Battery (V)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 3.6" value={battery} onChange={e => setBattery(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {FIELDS.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}{f.unit ? ` (${f.unit})` : ""}</Label>
                    <Input
                      type="number" step={f.step} placeholder="—"
                      value={values[f.key]}
                      onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-2 h-4 w-4" />Record reading</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">Recent Readings</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {fetching ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Device</TableHead>
                  {FIELDS.map(f => <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(r.recorded_at), "dd MMM HH:mm")}</TableCell>
                    <TableCell>{sensorName(r.sensor_id)}</TableCell>
                    {FIELDS.map(f => (
                      <TableCell key={f.key} className="font-mono">
                        {(r[f.key as keyof Reading] as number | null) ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {readings.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No readings yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
