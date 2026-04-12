import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Wifi, WifiOff, Wrench, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors"> & { sensor_types?: Tables<"sensor_types"> | null };
type SensorType = Tables<"sensor_types">;

export default function SensorsPage() {
  const { currentOrg, currentRole } = useOrg();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorTypes, setSensorTypes] = useState<SensorType[]>([]);
  const [zones, setZones] = useState<Tables<"zones">[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", sensor_type_id: "", zone_id: "", ip_address: "" });
  const { toast } = useToast();
  const canEdit = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchSensors = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.from("sensors").select("*, sensor_types(*), zones(*)").eq("org_id", currentOrg.id);
    setSensors((data as (Sensor & { zones?: Tables<"zones"> | null })[]) || []);
  };

  useEffect(() => {
    if (!currentOrg) return;
    fetchSensors();
    supabase.from("sensor_types").select("*").then(({ data }) => setSensorTypes(data || []));
    supabase.from("zones").select("*").eq("org_id", currentOrg.id).then(({ data }) => setZones(data || []));
  }, [currentOrg]);

  const handleAdd = async () => {
    if (!currentOrg || !form.name || !form.sensor_type_id) return;
    // Check limit: max 10 per type
    const countOfType = sensors.filter(s => s.sensor_type_id === form.sensor_type_id).length;
    if (countOfType >= 10) {
      toast({ title: "Limit reached", description: "Maximum 10 sensors per type.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("sensors").insert({
      org_id: currentOrg.id,
      name: form.name,
      sensor_type_id: form.sensor_type_id,
      zone_id: form.zone_id || null,
      ip_address: form.ip_address || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sensor added" });
    setOpen(false);
    setForm({ name: "", sensor_type_id: "", zone_id: "", ip_address: "" });
    fetchSensors();
  };

  const statusIcon = (s: string) => {
    if (s === "online") return <Wifi className="h-4 w-4 text-success" />;
    if (s === "offline") return <WifiOff className="h-4 w-4 text-destructive" />;
    return <Wrench className="h-4 w-4 text-warning" />;
  };

  const statusBadge = (s: string) => {
    const v = s === "online" ? "default" : s === "offline" ? "destructive" : "secondary";
    return <Badge variant={v}>{s}</Badge>;
  };

  // Filter sensors by selected zone
  const filteredSensors = selectedZone === "all" 
    ? sensors 
    : sensors.filter(s => s.zone_id === selectedZone);

  const getZoneName = (zoneId: string | null) => {
    if (!zoneId) return "No Zone";
    const zone = zones.find(z => z.id === zoneId);
    return zone?.name || "Unknown Zone";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Sensors</h1>
          <p className="text-muted-foreground">Manage your IoT sensors ({filteredSensors.length} of {sensors.length})</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Zone Filter */}
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map(z => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Sensor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Add New Sensor</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input placeholder="Sensor Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <Select value={form.sensor_type_id} onValueChange={v => setForm({ ...form, sensor_type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Sensor Type" /></SelectTrigger>
                    <SelectContent>
                      {sensorTypes.map(st => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name} ({st.unit}) — {sensors.filter(s => s.sensor_type_id === st.id).length}/10
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={form.zone_id} onValueChange={v => setForm({ ...form, zone_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Zone (optional)" /></SelectTrigger>
                    <SelectContent>
                      {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="IP Address (optional)" value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} />
                  <Button onClick={handleAdd} className="w-full">Add Sensor</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Group by type, filtered by zone */}
      {sensorTypes.map(st => {
        const typeSensors = filteredSensors.filter(s => s.sensor_type_id === st.id);
        if (typeSensors.length === 0) return null;
        return (
          <div key={st.id}>
            <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
              {st.name} <span className="text-sm font-normal text-muted-foreground">({typeSensors.length}/10)</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {typeSensors.map(sensor => (
                <Card key={sensor.id} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{sensor.name}</span>
                      {statusBadge(sensor.status)}
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">{statusIcon(sensor.status)} {sensor.ip_address || "No IP"}</span>
                      <span className="text-xs pl-5">📍 {getZoneName(sensor.zone_id)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {filteredSensors.length === 0 && sensors.length > 0 && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No sensors in this zone</p>
            <p className="text-sm">Select a different zone or add sensors</p>
          </CardContent>
        </Card>
      )}

      {sensors.length === 0 && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No sensors yet</p>
            <p className="text-sm">Add your first sensor to start monitoring</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
