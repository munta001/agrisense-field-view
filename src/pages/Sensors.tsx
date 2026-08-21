import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Radio, Battery, MapPin, Activity, Thermometer, Droplets, Zap, FlaskConical, Leaf, Sprout, Beaker, Waves } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors">;
type Reading = Tables<"sensor_readings">;

const METRICS = [
  { key: "temperature_c", label: "Temp", unit: "°C", icon: Thermometer },
  { key: "moisture_pct", label: "Moisture", unit: "%", icon: Droplets },
  { key: "conductivity", label: "EC", unit: "µS/cm", icon: Zap },
  { key: "ph", label: "pH", unit: "", icon: FlaskConical },
  { key: "nitrogen", label: "N", unit: "mg/kg", icon: Leaf },
  { key: "phosphorus", label: "P", unit: "mg/kg", icon: Sprout },
  { key: "potassium", label: "K", unit: "mg/kg", icon: Beaker },
  { key: "salinity", label: "Salinity", unit: "", icon: Waves },
] as const;

export default function SensorsPage() {
  const { currentOrg, currentRole } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [latest, setLatest] = useState<Record<string, Reading>>({});
  const [zones, setZones] = useState<Tables<"zones">[]>([]);
  const [loraTypeId, setLoraTypeId] = useState<string>("");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", device_id: "", zone_id: "", location: "" });
  const [editSensor, setEditSensor] = useState<Sensor | null>(null);
  const [editZoneId, setEditZoneId] = useState<string>("");
  const [manageSensor, setManageSensor] = useState<Sensor | null>(null);
  const [manageName, setManageName] = useState("");
  const [manageStatus, setManageStatus] = useState("online");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canEdit = currentRole?.role === "admin" || currentRole?.role === "operator";
  const isAdmin = currentRole?.role === "admin";

  const fetchAll = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: s }, { data: z }, { data: t }] = await Promise.all([
      supabase.from("sensors").select("*").eq("org_id", currentOrg.id).order("device_id", { ascending: true }),
      supabase.from("zones").select("*").eq("org_id", currentOrg.id),
      supabase.from("sensor_types").select("id, name").eq("name", "Soil 8-in-1 (LoRaWAN)").maybeSingle(),
    ]);
    const list = s || [];
    setSensors(list);
    setZones(z || []);
    setLoraTypeId(t?.id || "");

    if (list.length) {
      const { data: r } = await supabase
        .from("sensor_readings")
        .select("*")
        .in("sensor_id", list.map(x => x.id))
        .order("recorded_at", { ascending: false })
        .limit(1000);
      const map: Record<string, Reading> = {};
      (r || []).forEach(row => { if (row.sensor_id && !map[row.sensor_id]) map[row.sensor_id] = row; });
      setLatest(map);
    } else {
      setLatest({});
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [currentOrg]);

  const handleAdd = async () => {
    if (!currentOrg || !form.name || !form.device_id) return;
    const { error } = await supabase.from("sensors").insert({
      org_id: currentOrg.id,
      sensor_type_id: loraTypeId,
      name: form.name,
      device_id: parseInt(form.device_id, 10),
      zone_id: form.zone_id || null,
      location: form.location || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Device registered" });
    setOpen(false);
    setForm({ name: "", device_id: "", zone_id: "", location: "" });
    fetchAll();
  };

  const handleUpdateZone = async () => {
    if (!editSensor) return;
    const newZoneId = editZoneId === "none" ? null : editZoneId || null;
    const { error } = await supabase.from("sensors").update({ zone_id: newZoneId }).eq("id", editSensor.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Device zone updated" });
    setEditSensor(null);
    fetchAll();
  };

  const handleSaveManage = async () => {
    if (!manageSensor || !manageName.trim()) return;
    const { error } = await supabase.from("sensors")
      .update({ name: manageName.trim(), status: manageStatus })
      .eq("id", manageSensor.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Device updated" });
    setManageSensor(null);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!manageSensor) return;
    const { error } = await supabase.from("sensors").delete().eq("id", manageSensor.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Device deleted", description: "All readings for this device were removed." });
    setConfirmDelete(false);
    setManageSensor(null);
    fetchAll();
  };

  const zoneName = (zoneId: string | null) => (zoneId ? zones.find(z => z.id === zoneId)?.name || "Unknown zone" : "No zone");
  const filtered = selectedZone === "all" ? sensors : sensors.filter(s => s.zone_id === selectedZone);

  return (
    <div className="space-y-6">
      <Dialog open={!!editSensor} onOpenChange={o => { if (!o) setEditSensor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Update device zone</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Change zone for <strong>{editSensor?.name}</strong></p>
          <Select value={editZoneId} onValueChange={setEditZoneId}>
            <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No zone</SelectItem>
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleUpdateZone} className="w-full">Update zone</Button>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">LoRaWAN Devices</h1>
          <p className="text-muted-foreground">
            8-in-1 soil probes reporting temperature, moisture, EC, pH, N, P, K and salinity ({filtered.length} of {sensors.length})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Device</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Register LoRaWAN device</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input placeholder="Device name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <Input type="number" placeholder="Device ID (from uplink payload)" value={form.device_id} onChange={e => setForm({ ...form, device_id: e.target.value })} />
                  <Select value={form.zone_id} onValueChange={v => setForm({ ...form, zone_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select zone (optional)" /></SelectTrigger>
                    <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Location description (optional)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                  <Button onClick={handleAdd} className="w-full">Register device</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">{sensors.length === 0 ? "No devices yet" : "No devices in this zone"}</p>
            <p className="text-sm">{sensors.length === 0 ? "Register your first LoRaWAN probe to start monitoring" : "Select another zone"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map(sensor => {
            const r = latest[sensor.id];
            return (
              <Card key={sensor.id} className="glass-card cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/sensors/${sensor.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary" />
                        <span className="font-display font-semibold">{sensor.name}</span>
                        {sensor.device_id != null && <span className="font-mono text-xs text-muted-foreground">#{sensor.device_id}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{zoneName(sensor.zone_id)}</span>
                        {r?.battery_v != null && <span className="flex items-center gap-1"><Battery className="h-3 w-3" />{r.battery_v} V</span>}
                        {r && <span>{formatDistanceToNow(new Date(r.recorded_at), { addSuffix: true })}</span>}
                      </div>
                    </div>
                    <Badge variant={sensor.status === "online" ? "default" : sensor.status === "offline" ? "destructive" : "secondary"}>
                      {sensor.status}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {METRICS.map(m => {
                      const v = r ? (r[m.key as keyof Reading] as number | null) : null;
                      return (
                        <div key={m.key} className="rounded-lg bg-muted/50 p-2 text-center">
                          <m.icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                          <p className="mt-1 font-mono text-sm font-semibold">{v ?? "—"}</p>
                          <p className="text-[10px] leading-tight text-muted-foreground">{m.label}{m.unit ? ` (${m.unit})` : ""}</p>
                        </div>
                      );
                    })}
                  </div>

                  {canEdit && (
                    <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-7 text-xs"
                      onClick={e => { e.stopPropagation(); setEditSensor(sensor); setEditZoneId(sensor.zone_id || "none"); }}>
                      Change zone
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
