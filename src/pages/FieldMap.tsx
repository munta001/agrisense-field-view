import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, GripVertical, ImageIcon, Save } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Zone = Tables<"zones"> & { background_image_url?: string | null };
type Sensor = Tables<"sensors"> & { sensor_types?: Tables<"sensor_types"> | null };

const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;

export default function FieldMapPage() {
  const { currentOrg, currentRole } = useOrg();
  const [zones, setZones] = useState<Zone[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [activeZone, setActiveZone] = useState<string>("all");
  const [draggingSensor, setDraggingSensor] = useState<string | null>(null);
  const [pendingPositions, setPendingPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [uploadingZone, setUploadingZone] = useState<Zone | null>(null);
  const [uploading, setUploading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const isAdmin = currentRole?.role === "admin";
  const isAdminOrOperator = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    const [{ data: zoneData }, { data: sensorData }] = await Promise.all([
      supabase.from("zones").select("*").eq("org_id", currentOrg.id),
      supabase.from("sensors").select("*, sensor_types(*)").eq("org_id", currentOrg.id),
    ]);
    setZones((zoneData as Zone[]) || []);
    setSensors((sensorData as Sensor[]) || []);
    if (zoneData?.length && activeZone === "all") {
      // keep "all" as default
    }
  }, [currentOrg]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get sensors for current view
  const visibleSensors = activeZone === "all"
    ? sensors
    : sensors.filter(s => s.zone_id === activeZone);

  // Rect of a zone in the "All Zones" overview
  const zoneRect = (zoneId: string | null) => {
    const idx = zones.findIndex(z => z.id === zoneId);
    if (idx < 0) return null;
    const cols = 2;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const w = (MAP_WIDTH - 30) / cols;
    const h = (MAP_HEIGHT - 30) / Math.ceil(zones.length / cols);
    return { x: 10 + col * (w + 10), y: 10 + row * (h + 10), w, h };
  };

  // Raw stored/pending position in the single-zone coordinate space
  const rawPos = (s: Sensor) => {
    if (pendingPositions[s.id]) return pendingPositions[s.id];
    return {
      x: s.map_x ?? (50 + Math.abs(s.id.charCodeAt(0) % 7) * 100),
      y: s.map_y ?? (50 + Math.abs(s.id.charCodeAt(1) % 4) * 110),
    };
  };

  // Sensor positions: in "all" view, map into the sensor's own zone rectangle
  const getSensorPos = (s: Sensor) => {
    const pos = rawPos(s);
    if (activeZone !== "all") return pos;
    const rect = zoneRect(s.zone_id);
    if (!rect) return pos;
    const padX = 16;
    const padY = 34;
    return {
      x: rect.x + padX + (pos.x / MAP_WIDTH) * (rect.w - padX * 2),
      y: rect.y + padY + (pos.y / MAP_HEIGHT) * (rect.h - padY - 20),
    };
  };


  // SVG coordinate conversion
  const svgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.max(15, Math.min(MAP_WIDTH - 15, svgPt.x)),
      y: Math.max(15, Math.min(MAP_HEIGHT - 15, svgPt.y)),
    };
  };

  const handleMouseDown = (sensorId: string) => {
    if (!isAdmin) return;
    setDraggingSensor(sensorId);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingSensor) return;
    const pos = svgPoint(e.clientX, e.clientY);
    setPendingPositions(prev => ({ ...prev, [draggingSensor]: pos }));
  };

  const handleMouseUp = () => {
    setDraggingSensor(null);
  };

  const savePositions = async () => {
    const entries = Object.entries(pendingPositions);
    if (!entries.length) return;
    const promises = entries.map(([id, pos]) =>
      supabase.from("sensors").update({ map_x: pos.x, map_y: pos.y }).eq("id", id)
    );
    await Promise.all(promises);
    toast.success(`Saved ${entries.length} sensor position(s)`);
    setPendingPositions({});
    fetchData();
  };

  // Zone image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!uploadingZone || !e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split(".").pop();
    const path = `${currentOrg!.id}/${uploadingZone.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("zone-images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("zone-images").getPublicUrl(path);
    await supabase.from("zones").update({ background_image_url: urlData.publicUrl }).eq("id", uploadingZone.id);

    toast.success("Zone image uploaded!");
    setUploading(false);
    setUploadingZone(null);
    fetchData();
  };

  const getStatusColor = (status: string) => {
    if (status === "online") return "hsl(var(--success))";
    if (status === "offline") return "hsl(var(--destructive))";
    return "hsl(var(--warning))";
  };

  const activeZoneData = zones.find(z => z.id === activeZone);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Field Map</h1>
          <p className="text-muted-foreground">
            View sensor locations by zone
            {isAdmin && " — drag sensors to reposition"}
          </p>
        </div>
        {isAdmin && Object.keys(pendingPositions).length > 0 && (
          <Button onClick={savePositions} className="gap-2">
            <Save className="h-4 w-4" />
            Save Positions ({Object.keys(pendingPositions).length})
          </Button>
        )}
      </div>

      <Tabs value={activeZone} onValueChange={setActiveZone}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All Zones</TabsTrigger>
          {zones.map(z => (
            <TabsTrigger key={z.id} value={z.id} className="gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: z.color }} />
              {z.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Zone info bar */}
        {activeZoneData && (
          <div className="flex items-center gap-3 mt-3">
            <Badge variant="outline" style={{ borderColor: activeZoneData.color, color: activeZoneData.color }}>
              {sensors.filter(s => s.zone_id === activeZone).length} sensors
            </Badge>
            {isAdminOrOperator && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setUploadingZone(activeZoneData)}>
                <ImageIcon className="h-4 w-4" />
                {activeZoneData.background_image_url ? "Change Background" : "Upload Background"}
              </Button>
            )}
          </div>
        )}

        <Card className="glass-card overflow-hidden mt-4">
          <CardContent className="p-4">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="w-full h-auto rounded-lg select-none"
              style={{ background: "hsl(var(--muted))", cursor: draggingSensor ? "grabbing" : "default" }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background image for active zone */}
              {activeZoneData?.background_image_url && (
                <image
                  href={activeZoneData.background_image_url}
                  x={0} y={0}
                  width={MAP_WIDTH} height={MAP_HEIGHT}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={0.3}
                />
              )}

              {/* Grid */}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 80} y1={0} x2={(i + 1) * 80} y2={MAP_HEIGHT}
                  stroke="hsl(var(--border))" strokeWidth={0.5} />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={(i + 1) * 100} x2={MAP_WIDTH} y2={(i + 1) * 100}
                  stroke="hsl(var(--border))" strokeWidth={0.5} />
              ))}

              {/* Zone overlays when viewing all */}
              {activeZone === "all" && zones.map((zone) => {
                const idx = zones.indexOf(zone);
                const cols = 2;
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const w = (MAP_WIDTH - 30) / cols;
                const h = (MAP_HEIGHT - 30) / Math.ceil(zones.length / cols);
                const x = 10 + col * (w + 10);
                const y = 10 + row * (h + 10);
                return (
                  <g key={zone.id}>
                    <rect x={x} y={y} width={w} height={h}
                      fill={zone.color} fillOpacity={0.08}
                      stroke={zone.color} strokeWidth={2} rx={8} />
                    <text x={x + 12} y={y + 22} fill={zone.color} fontSize={13} fontWeight={600}>
                      {zone.name}
                    </text>
                  </g>
                );
              })}

              {/* Single zone border when viewing one zone */}
              {activeZoneData && (
                <rect x={10} y={10} width={MAP_WIDTH - 20} height={MAP_HEIGHT - 20}
                  fill={activeZoneData.color} fillOpacity={0.06}
                  stroke={activeZoneData.color} strokeWidth={2} rx={8}
                />
              )}

              {/* Sensors */}
              {visibleSensors.map(sensor => {
                const pos = getSensorPos(sensor);
                const color = getStatusColor(sensor.status);
                const isPending = !!pendingPositions[sensor.id];
                return (
                  <g key={sensor.id}
                    onMouseDown={() => handleMouseDown(sensor.id)}
                    style={{ cursor: isAdmin ? "grab" : "default" }}
                  >
                    {/* Outer ring */}
                    <circle cx={pos.x} cy={pos.y} r={16}
                      fill={color} fillOpacity={0.15}
                      stroke={color} strokeWidth={isPending ? 3 : 2}
                      strokeDasharray={isPending ? "4 2" : "none"}
                    />
                    {/* Inner dot */}
                    <circle cx={pos.x} cy={pos.y} r={6} fill={color} />
                    {/* Drag indicator for admin */}
                    {isAdmin && (
                      <circle cx={pos.x} cy={pos.y} r={20}
                        fill="transparent" stroke="transparent"
                      />
                    )}
                    {/* Label */}
                    <text x={pos.x} y={pos.y + 28} textAnchor="middle"
                      fill="hsl(var(--foreground))" fontSize={10} fontWeight={500}>
                      {sensor.name}
                    </text>
                    {/* Type label */}
                    {sensor.sensor_types && (
                      <text x={pos.x} y={pos.y + 40} textAnchor="middle"
                        fill="hsl(var(--muted-foreground))" fontSize={8}>
                        {sensor.sensor_types.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {visibleSensors.length === 0 && (
                <text x={MAP_WIDTH / 2} y={MAP_HEIGHT / 2} textAnchor="middle"
                  fill="hsl(var(--muted-foreground))" fontSize={16}>
                  No sensors in this zone
                </text>
              )}
            </svg>
          </CardContent>
        </Card>
      </Tabs>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {zones.map(z => (
          <div key={z.id} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: z.color }} />
            <span className="text-sm text-muted-foreground">{z.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-4">
          <div className="h-3 w-3 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-destructive" />
          <span className="text-sm text-muted-foreground">Offline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-warning" />
          <span className="text-sm text-muted-foreground">Maintenance</span>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={!!uploadingZone} onOpenChange={() => setUploadingZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Zone Background</DialogTitle>
            <DialogDescription>
              Upload an aerial photo or map image for {uploadingZone?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {uploadingZone?.background_image_url && (
              <img src={uploadingZone.background_image_url} alt="Current background"
                className="w-full h-32 object-cover rounded-md border" />
            )}
            <div>
              <Label htmlFor="zone-image">Select Image</Label>
              <Input id="zone-image" type="file" accept="image/*"
                onChange={handleImageUpload} disabled={uploading} className="mt-1" />
            </div>
            {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
