import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Upload, Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Crop = { id: string; name: string; category: string };
type CropStage = { id: string; crop_id: string; name: string; stage_order: number; duration_days?: number };
type Zone = {
  id: string; org_id: string; name: string; color: string;
  background_image_url: string | null; crop_id: string | null; crop_stage_id: string | null;
  crop_start_date: string | null;
  crops?: Crop | null; crop_stages?: CropStage | null;
};

export default function ZonesPage() {
  const { currentOrg, currentRole } = useOrg();
  const [zones, setZones] = useState<Zone[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [cropStages, setCropStages] = useState<CropStage[]>([]);
  const [sensorCounts, setSensorCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [form, setForm] = useState({ name: "", color: "#22c55e", crop_id: "", crop_stage_id: "", crop_start_date: "" });
  const { toast } = useToast();
  const canEdit = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchZones = async () => {
    if (!currentOrg) return;
    await supabase.rpc("sync_zone_stages" as any, { p_org_id: currentOrg.id });
    const { data } = await supabase.from("zones").select("*, crops(*), crop_stages(*)").eq("org_id", currentOrg.id);
    setZones((data as Zone[]) || []);
    const { data: sensors } = await supabase.from("sensors").select("zone_id").eq("org_id", currentOrg.id);
    const counts: Record<string, number> = {};
    (sensors || []).forEach(s => { if (s.zone_id) counts[s.zone_id] = (counts[s.zone_id] || 0) + 1; });
    setSensorCounts(counts);
  };

  useEffect(() => {
    if (!currentOrg) return;
    fetchZones();
    supabase.from("crops").select("id, name, category").eq("org_id", currentOrg.id).then(({ data }) => setCrops(data || []));
    supabase.from("crop_stages").select("*").then(({ data }) => setCropStages(data || []));
  }, [currentOrg]);

  const filteredStages = (cropId: string) => cropStages.filter(s => s.crop_id === cropId);

  const cleanId = (v: string) => (v && v !== "none" ? v : null);

  const handleSave = async () => {
    if (!currentOrg || !form.name) return;
    if (editZone) {
      const { error } = await supabase.from("zones").update({
        name: form.name,
        color: form.color,
        crop_id: cleanId(form.crop_id),
        crop_stage_id: cleanId(form.crop_stage_id),
        crop_start_date: form.crop_start_date || null,
      } as any).eq("id", editZone.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Zone updated" });
    } else {
      const limit = (currentOrg as any)?.zone_limit ?? 0;
      if (zones.length >= limit) {
        toast({
          title: "Zone allowance reached",
          description: `Your plan allows ${limit} zone${limit === 1 ? "" : "s"}. Contact the platform administrator to increase it.`,
          variant: "destructive",
        });
        return;
      }
      const { error } = await supabase.from("zones").insert({
        org_id: currentOrg.id,
        name: form.name,
        color: form.color,
        crop_id: cleanId(form.crop_id),
        crop_stage_id: cleanId(form.crop_stage_id),
        crop_start_date: form.crop_start_date || null,
      } as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Zone created" });
    }
    closeDialog();
    fetchZones();
  };

  const closeDialog = () => {
    setOpen(false);
    setEditZone(null);
    setForm({ name: "", color: "#22c55e", crop_id: "", crop_stage_id: "", crop_start_date: "" });
  };

  const openEdit = (zone: Zone) => {
    setEditZone(zone);
    setForm({
      name: zone.name,
      color: zone.color,
      crop_id: zone.crop_id || "",
      crop_stage_id: zone.crop_stage_id || "",
      crop_start_date: zone.crop_start_date || "",
    });
    setOpen(true);
  };

  const handleImageUpload = async (zoneId: string, file: File) => {
    const path = `${currentOrg!.id}/${zoneId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from("zone-images").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("zone-images").getPublicUrl(path);
    await supabase.from("zones").update({ background_image_url: urlData.publicUrl }).eq("id", zoneId);
    toast({ title: "Image uploaded" });
    fetchZones();
  };

  const zoneLimit = (currentOrg as any)?.zone_limit ?? 0;
  const limitReached = zones.length >= zoneLimit;
  const remaining = Math.max(0, zoneLimit - zones.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Zone Management</h1>
          <p className="text-muted-foreground">Create and manage farm zones with crop assignments</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button
                disabled={limitReached}
                onClick={e => {
                  if (limitReached) {
                    e.preventDefault();
                    toast({
                      title: "Zone allowance reached",
                      description: `Your plan allows ${zoneLimit} zone${zoneLimit === 1 ? "" : "s"}. Contact the platform administrator to increase it.`,
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />Add Zone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editZone ? "Edit Zone" : "Add New Zone"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Zone Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground">Color</label>
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-8 w-12 rounded cursor-pointer" />
                </div>
                <Select value={form.crop_id} onValueChange={v => setForm({ ...form, crop_id: v, crop_stage_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Crop (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Crop</SelectItem>
                    {crops.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.category})</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.crop_id && form.crop_id !== "none" && (
                  <Select value={form.crop_stage_id} onValueChange={v => setForm({ ...form, crop_stage_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Crop Stage (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Stage</SelectItem>
                      {filteredStages(form.crop_id).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} (Order: {s.stage_order})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {form.crop_id && form.crop_id !== "none" && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Crop start date</label>
                    <Input type="date" value={form.crop_start_date} onChange={e => setForm({ ...form, crop_start_date: e.target.value })} />
                    <p className="text-xs text-muted-foreground">
                      The stage moves on automatically using each stage's duration, counted from this date. You can still pick a stage manually.
                    </p>
                  </div>
                )}
                <Button onClick={handleSave} className="w-full">{editZone ? "Update Zone" : "Create Zone"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {currentOrg && (
        <div className={`rounded-lg border p-4 ${limitReached ? "border-destructive/40 bg-destructive/10" : "bg-card"}`}>
          <div>
            <p className="text-sm font-medium">
              Zone allowance — {zones.length} of {zoneLimit} used
            </p>
            <p className="text-xs text-muted-foreground">
              {limitReached
                ? "You have reached your subscription limit. Contact the platform administrator to add more zones."
                : `You can still create ${remaining} more zone${remaining === 1 ? "" : "s"} on your current subscription.`}
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${limitReached ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${zoneLimit ? Math.min(100, (zones.length / zoneLimit) * 100) : 100}%` }}
            />
          </div>
        </div>
      )}


      {zones.length === 0 && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No zones created yet</p>
            <p className="text-sm">Create your first zone to organize your farm</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map(zone => (
          <Card key={zone.id} className="glass-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => canEdit && openEdit(zone)}>
            {zone.background_image_url && (
              <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${zone.background_image_url})` }} />
            )}
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: zone.color }} />
                  {zone.name}
                </CardTitle>
                <Badge variant="outline">{sensorCounts[zone.id] || 0} sensors</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 text-sm text-muted-foreground">
                {zone.crops ? (
                  <div className="flex items-center gap-1">
                    <Sprout className="h-3 w-3" />
                    <span>{zone.crops.name} ({zone.crops.category})</span>
                  </div>
                ) : (
                  <span className="text-xs">No crop assigned</span>
                )}
                {zone.crop_stages && (
                  <div className="text-xs">Stage: {zone.crop_stages.name}</div>
                )}
                {zone.crop_start_date && (
                  <div className="text-xs">
                    Started {zone.crop_start_date} · day{" "}
                    {Math.max(0, Math.floor((Date.now() - new Date(zone.crop_start_date).getTime()) / 86400000)) + 1}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="mt-3">
                  <label className="cursor-pointer" onClick={e => e.stopPropagation()}>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      if (e.target.files?.[0]) handleImageUpload(zone.id, e.target.files[0]);
                    }} />
                    <div className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Upload className="h-3 w-3" /> Upload image
                    </div>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
