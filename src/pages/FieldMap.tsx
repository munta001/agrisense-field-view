import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BatteryMedium,
  ImagePlus,
  LocateFixed,
  MapPinned,
  Move,
  Radio,
  Save,
  Sprout,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Zone = Tables<"zones"> & {
  background_image_url?: string | null;
  crops?: { name: string } | null;
  crop_stages?: { name: string } | null;
};
type Sensor = Tables<"sensors"> & { sensor_types?: Tables<"sensor_types"> | null };

const MAP_WIDTH = 960;
const MAP_HEIGHT = 600;

const statusClass = (status: string) => {
  if (status === "online") return "bg-success";
  if (status === "offline") return "bg-destructive";
  return "bg-warning";
};

const statusColor = (status: string) => {
  if (status === "online") return "hsl(var(--success))";
  if (status === "offline") return "hsl(var(--destructive))";
  return "hsl(var(--warning))";
};

export default function FieldMapPage() {
  const { currentOrg, currentRole } = useOrg();
  const [zones, setZones] = useState<Zone[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [activeZone, setActiveZone] = useState("");
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [draggingSensor, setDraggingSensor] = useState<string | null>(null);
  const [pendingPositions, setPendingPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [uploadingZone, setUploadingZone] = useState<Zone | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const isAdmin = currentRole?.role === "admin";
  const isAdminOrOperator = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: zoneData }, { data: sensorData }] = await Promise.all([
      supabase
        .from("zones")
        .select("*, crops(name), crop_stages(name)")
        .eq("org_id", currentOrg.id)
        .order("name"),
      supabase
        .from("sensors")
        .select("*, sensor_types(*)")
        .eq("org_id", currentOrg.id)
        .order("name"),
    ]);
    const nextZones = (zoneData as Zone[]) || [];
    setZones(nextZones);
    setSensors((sensorData as Sensor[]) || []);
    setActiveZone((current) => nextZones.some((zone) => zone.id === current) ? current : nextZones[0]?.id ?? "");
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeZoneData = zones.find((zone) => zone.id === activeZone) ?? null;
  const visibleSensors = useMemo(
    () => sensors.filter((sensor) => sensor.zone_id === activeZone && sensor.is_active !== false),
    [activeZone, sensors],
  );
  const selectedSensorData = visibleSensors.find((sensor) => sensor.id === selectedSensor) ?? null;
  const onlineCount = visibleSensors.filter((sensor) => sensor.status === "online").length;
  const offlineCount = visibleSensors.filter((sensor) => sensor.status === "offline").length;
  const pendingCount = Object.keys(pendingPositions).length;

  useEffect(() => {
    setSelectedSensor(null);
    setDraggingSensor(null);
    setPendingPositions({});
  }, [activeZone]);

  const rawPosition = (sensor: Sensor) => {
    if (pendingPositions[sensor.id]) return pendingPositions[sensor.id];
    return {
      x: sensor.map_x ?? 90 + Math.abs(sensor.id.charCodeAt(0) % 7) * 110,
      y: sensor.map_y ?? 90 + Math.abs(sensor.id.charCodeAt(1) % 4) * 120,
    };
  };

  const svgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(matrix.inverse());
    return {
      x: Math.max(34, Math.min(MAP_WIDTH - 34, transformed.x)),
      y: Math.max(34, Math.min(MAP_HEIGHT - 54, transformed.y)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGGElement>, sensorId: string) => {
    setSelectedSensor(sensorId);
    if (!isAdmin) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    setDraggingSensor(sensorId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingSensor) return;
    const position = svgPoint(event.clientX, event.clientY);
    setPendingPositions((current) => ({ ...current, [draggingSensor]: position }));
  };

  const stopDragging = (event: React.PointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    setDraggingSensor(null);
  };

  const savePositions = async () => {
    const entries = Object.entries(pendingPositions);
    if (!entries.length) return;
    const results = await Promise.all(
      entries.map(([id, position]) =>
        supabase.from("sensors").update({ map_x: position.x, map_y: position.y }).eq("id", id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      toast.error("Positions could not be saved");
      return;
    }
    toast.success(`${entries.length} device position${entries.length === 1 ? "" : "s"} saved`);
    setPendingPositions({});
    fetchData();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!uploadingZone || !file || !currentOrg) return;
    setUploading(true);
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${currentOrg.id}/${uploadingZone.id}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("zone-images").upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("zone-images").getPublicUrl(path);
    const { error } = await supabase
      .from("zones")
      .update({ background_image_url: data.publicUrl })
      .eq("id", uploadingZone.id);
    if (error) {
      toast.error("The map image could not be updated");
    } else {
      toast.success("Zone map updated");
      setUploadingZone(null);
      fetchData();
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 rounded-md bg-muted" />
        <div className="h-[620px] rounded-md bg-muted" />
      </div>
    );
  }

  if (!zones.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed bg-card">
        <div className="max-w-sm space-y-3 px-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <MapPinned className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-semibold">No zones to map</h1>
          <p className="text-sm text-muted-foreground">Create a zone before placing devices on the field map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
            <MapPinned className="h-4 w-4" />
            Field operations
          </div>
          <h1 className="font-display text-2xl font-bold">Zone map</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor device coverage and manage exact field positions.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <Select value={activeZone} onValueChange={setActiveZone}>
            <SelectTrigger className="h-10 w-full bg-card sm:w-[260px]" aria-label="Select zone">
              <SelectValue placeholder="Select a zone" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingCount > 0 && (
            <Button onClick={savePositions} className="gap-2">
              <Save className="h-4 w-4" />
              Save {pendingCount} change{pendingCount === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary"><Radio /></div>
            <div><p className="text-xs text-muted-foreground">Devices</p><p className="text-lg font-semibold">{visibleSensors.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10 text-success"><Wifi /></div>
            <div><p className="text-xs text-muted-foreground">Online</p><p className="text-lg font-semibold">{onlineCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 text-destructive"><WifiOff /></div>
            <div><p className="text-xs text-muted-foreground">Offline</p><p className="text-lg font-semibold">{offlineCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary"><Sprout /></div>
            <div className="min-w-0"><p className="text-xs text-muted-foreground">Crop stage</p><p className="truncate text-sm font-semibold">{activeZoneData?.crop_stages?.name || activeZoneData?.crops?.name || "Not assigned"}</p></div>
          </CardContent>
        </Card>
      </section>

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-8 w-1 rounded-full bg-primary" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display font-semibold">{activeZoneData?.name}</h2>
                <Badge variant="secondary" className="font-normal">Live map</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {activeZoneData?.crops?.name ? `${activeZoneData.crops.name}${activeZoneData.crop_stages?.name ? ` · ${activeZoneData.crop_stages.name}` : ""}` : "No crop assigned"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"><Move className="h-3.5 w-3.5" /> Drag devices to reposition</span>}
            {isAdminOrOperator && activeZoneData && (
              <Button variant="outline" size="sm" onClick={() => setUploadingZone(activeZoneData)}>
                <ImagePlus className="h-4 w-4" />
                {activeZoneData.background_image_url ? "Replace map" : "Add map image"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid min-h-[520px] lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative min-w-0 overflow-hidden bg-muted/40 p-3 sm:p-5">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="h-full min-h-[420px] w-full touch-none select-none rounded-md border bg-card shadow-inner"
              preserveAspectRatio="xMidYMid meet"
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              onPointerLeave={(event) => draggingSensor && stopDragging(event)}
              style={{ cursor: draggingSensor ? "grabbing" : "default" }}
            >
              <defs>
                <pattern id="field-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M 48 0 L 0 0 0 48" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.62" />
                </pattern>
                <filter id="marker-shadow" x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="hsl(var(--foreground))" floodOpacity="0.18" />
                </filter>
              </defs>

              {activeZoneData?.background_image_url && (
                <image href={activeZoneData.background_image_url} width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="xMidYMid slice" opacity="0.82" />
              )}
              <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#field-grid)" />
              <rect x="14" y="14" width={MAP_WIDTH - 28} height={MAP_HEIGHT - 28} rx="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="7 6" opacity="0.56" />

              {visibleSensors.map((sensor) => {
                const position = rawPosition(sensor);
                const color = statusColor(sensor.status);
                const isSelected = selectedSensor === sensor.id;
                const isPending = Boolean(pendingPositions[sensor.id]);
                return (
                  <g
                    key={sensor.id}
                    onPointerDown={(event) => handlePointerDown(event, sensor.id)}
                    style={{ cursor: isAdmin ? "grab" : "pointer" }}
                    filter="url(#marker-shadow)"
                  >
                    <title>{`${sensor.name} · ${sensor.status}`}</title>
                    {isSelected && <circle cx={position.x} cy={position.y} r="28" fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 4" />}
                    <circle cx={position.x} cy={position.y} r="20" fill="hsl(var(--card))" stroke={color} strokeWidth={isPending ? 4 : 3} />
                    <circle cx={position.x} cy={position.y} r="8" fill={color} />
                    <rect x={position.x - 54} y={position.y + 27} width="108" height="24" rx="5" fill="hsl(var(--card))" opacity="0.94" />
                    <text x={position.x} y={position.y + 43} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="600">
                      {sensor.name.length > 16 ? `${sensor.name.slice(0, 14)}…` : sensor.name}
                    </text>
                  </g>
                );
              })}

              {!visibleSensors.length && (
                <g>
                  <circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2 - 20} r="30" fill="hsl(var(--secondary))" />
                  <text x={MAP_WIDTH / 2} y={MAP_HEIGHT / 2 - 14} textAnchor="middle" fill="hsl(var(--primary))" fontSize="22">◎</text>
                  <text x={MAP_WIDTH / 2} y={MAP_HEIGHT / 2 + 30} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="16" fontWeight="600">No active devices in this zone</text>
                </g>
              )}
            </svg>
            <div className="absolute bottom-7 left-7 hidden items-center gap-3 rounded-md border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur sm:flex">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Online</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Offline</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />Maintenance</span>
            </div>
          </div>

          <aside className="border-t bg-card lg:border-l lg:border-t-0">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Devices in zone</p>
              <p className="text-xs text-muted-foreground">Select a device to locate it</p>
            </div>
            <div className="max-h-[520px] space-y-1 overflow-y-auto p-2">
              {visibleSensors.map((sensor) => (
                <button
                  key={sensor.id}
                  type="button"
                  onClick={() => setSelectedSensor(sensor.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${selectedSensor === sensor.id ? "bg-secondary" : "hover:bg-muted"}`}
                >
                  <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted ${sensor.status === "online" ? "text-success" : sensor.status === "offline" ? "text-destructive" : "text-warning"}`}>
                    <Radio className="h-4 w-4" />
                    <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card ${statusClass(sensor.status)}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{sensor.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{sensor.sensor_types?.name || sensor.device_id || "LoRaWAN device"}</span>
                  </span>
                  <LocateFixed className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {!visibleSensors.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No active devices</p>}
            </div>
            {selectedSensorData && (
              <div className="border-t p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selectedSensorData.name}</p>
                    <p className="capitalize text-xs text-muted-foreground">{selectedSensorData.status}</p>
                  </div>
                  <Badge variant="outline" className="gap-1"><BatteryMedium className="h-3 w-3" />{selectedSensorData.battery_level ?? "—"}%</Badge>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <Dialog open={Boolean(uploadingZone)} onOpenChange={(open) => !open && setUploadingZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update zone map</DialogTitle>
            <DialogDescription>Upload an aerial photo or field plan for {uploadingZone?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {uploadingZone?.background_image_url && (
              <img src={uploadingZone.background_image_url} alt={`Current map for ${uploadingZone.name}`} className="h-44 w-full rounded-md border object-cover" />
            )}
            <div className="space-y-2">
              <Label htmlFor="zone-image">Map image</Label>
              <div className="relative rounded-md border border-dashed p-5 text-center">
                <Upload className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Choose an aerial photo or field plan</p>
                <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP</p>
                <Input id="zone-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploading} className="absolute inset-0 h-full cursor-pointer opacity-0" />
              </div>
            </div>
            {uploading && <p className="text-sm text-muted-foreground">Uploading map image…</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}