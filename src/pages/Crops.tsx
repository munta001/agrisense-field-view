import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Sprout, Layers, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SOIL_METRICS, metricLabel, metricUnit } from "@/lib/metrics";

type SensorType = { id: string; name: string; unit: string; min_value: number | null; max_value: number | null };
type Threshold = { id: string; crop_stage_id: string; sensor_type_id: string | null; metric: string | null; min_value: number | null; max_value: number | null };
type CropStage = { id: string; crop_id: string; name: string; stage_order: number; duration_days: number; description: string | null; thresholds: Threshold[] };
type Crop = { id: string; org_id: string; name: string; category: string; description: string | null; crop_stages: CropStage[] };

export default function CropsPage() {
  const { currentOrg, currentRole, loading: orgLoading } = useOrg();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [sensorTypes, setSensorTypes] = useState<SensorType[]>([]);
  const [loading, setLoading] = useState(true);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropForm, setCropForm] = useState({ name: "", category: "", description: "" });
  const [stageOpen, setStageOpen] = useState<string | null>(null);
  const [stageForm, setStageForm] = useState({ name: "", description: "", stage_order: 0, duration_days: 0 });
  const [thresholdOpen, setThresholdOpen] = useState<string | null>(null);
  const [thresholdForm, setThresholdForm] = useState({ metric: "", min_value: "", max_value: "" });
  const [editCrop, setEditCrop] = useState<Crop | null>(null);
  const [editCropForm, setEditCropForm] = useState({ name: "", category: "", description: "" });
  const [editStage, setEditStage] = useState<CropStage | null>(null);
  const [editStageForm, setEditStageForm] = useState({ name: "", description: "", stage_order: 0, duration_days: 0 });
  const [editThreshold, setEditThreshold] = useState<Threshold | null>(null);
  const [editThresholdForm, setEditThresholdForm] = useState({ min_value: "", max_value: "" });
  const { toast } = useToast();
  const canEdit = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchCrops = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data: cropsData } = await supabase.from("crops").select("*").eq("org_id", currentOrg.id);
    if (!cropsData) { setCrops([]); setLoading(false); return; }

    const cropIds = cropsData.map(c => c.id);
    const { data: stagesData } = await supabase.from("crop_stages").select("*").in("crop_id", cropIds).order("stage_order");
    const stageIds = (stagesData || []).map(s => s.id);
    const { data: thresholdsData } = stageIds.length > 0
      ? await supabase.from("crop_stage_thresholds").select("*").in("crop_stage_id", stageIds)
      : { data: [] };

    const merged: Crop[] = cropsData.map(c => ({
      ...c,
      crop_stages: (stagesData || [])
        .filter(s => s.crop_id === c.id)
        .map(s => ({
          ...s,
          thresholds: (thresholdsData || []).filter(t => t.crop_stage_id === s.id),
        })),
    }));
    setCrops(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (!currentOrg) return;
    fetchCrops();
    supabase.from("sensor_types").select("*").then(({ data }) => setSensorTypes(data || []));
  }, [currentOrg]);

  const addCrop = async () => {
    if (!currentOrg || !cropForm.name) return;
    const { error } = await supabase.from("crops").insert({
      org_id: currentOrg.id,
      name: cropForm.name,
      category: cropForm.category,
      description: cropForm.description || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Crop added" });
    setCropOpen(false);
    setCropForm({ name: "", category: "", description: "" });
    fetchCrops();
  };

  const addStage = async (cropId: string) => {
    if (!stageForm.name) return;
    const { error } = await supabase.from("crop_stages").insert({
      crop_id: cropId,
      name: stageForm.name,
      description: stageForm.description || null,
      stage_order: stageForm.stage_order,
      duration_days: Math.max(0, Number(stageForm.duration_days) || 0),
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Stage added" });
    setStageOpen(null);
    setStageForm({ name: "", description: "", stage_order: 0, duration_days: 0 });
    fetchCrops();
  };

  const addThreshold = async (stageId: string) => {
    if (!thresholdForm.metric) return;
    if (!thresholdForm.min_value && !thresholdForm.max_value) {
      toast({ title: "Enter a minimum or maximum value", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("crop_stage_thresholds").insert({
      crop_stage_id: stageId,
      metric: thresholdForm.metric,
      min_value: thresholdForm.min_value ? Number(thresholdForm.min_value) : null,
      max_value: thresholdForm.max_value ? Number(thresholdForm.max_value) : null,
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Threshold added" });
    setThresholdOpen(null);
    setThresholdForm({ metric: "", min_value: "", max_value: "" });
    fetchCrops();
  };

  const deleteThreshold = async (id: string) => {
    await supabase.from("crop_stage_thresholds").delete().eq("id", id);
    fetchCrops();
  };

  const deleteStage = async (id: string) => {
    await supabase.from("crop_stages").delete().eq("id", id);
    fetchCrops();
  };

  const deleteCrop = async (id: string) => {
    await supabase.from("crops").delete().eq("id", id);
    fetchCrops();
  };

  const openEditCrop = (crop: Crop) => {
    setEditCrop(crop);
    setEditCropForm({ name: crop.name, category: crop.category || "", description: crop.description || "" });
  };

  const saveCrop = async () => {
    if (!editCrop || !editCropForm.name) return;
    const { error } = await supabase.from("crops").update({
      name: editCropForm.name,
      category: editCropForm.category,
      description: editCropForm.description || null,
    }).eq("id", editCrop.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Crop updated" });
    setEditCrop(null);
    fetchCrops();
  };

  const openEditStage = (stage: CropStage) => {
    setEditStage(stage);
    setEditStageForm({ name: stage.name, description: stage.description || "", stage_order: stage.stage_order, duration_days: stage.duration_days || 0 });
  };

  const saveStage = async () => {
    if (!editStage || !editStageForm.name) return;
    const { error } = await supabase.from("crop_stages").update({
      name: editStageForm.name,
      description: editStageForm.description || null,
      stage_order: editStageForm.stage_order,
      duration_days: Math.max(0, Number(editStageForm.duration_days) || 0),
    } as any).eq("id", editStage.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Stage updated" });
    setEditStage(null);
    fetchCrops();
  };

  const openEditThreshold = (t: Threshold) => {
    setEditThreshold(t);
    setEditThresholdForm({ min_value: t.min_value != null ? String(t.min_value) : "", max_value: t.max_value != null ? String(t.max_value) : "" });
  };

  const saveThreshold = async () => {
    if (!editThreshold) return;
    if (!editThresholdForm.min_value && !editThresholdForm.max_value) {
      toast({ title: "Enter a minimum or maximum value", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("crop_stage_thresholds").update({
      min_value: editThresholdForm.min_value ? Number(editThresholdForm.min_value) : null,
      max_value: editThresholdForm.max_value ? Number(editThresholdForm.max_value) : null,
    } as any).eq("id", editThreshold.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Threshold updated" });
    setEditThreshold(null);
    fetchCrops();
  };

  const getSensorTypeName = (id: string | null) => sensorTypes.find(st => st.id === id)?.name || "Unknown";
  const getSensorTypeUnit = (id: string | null) => sensorTypes.find(st => st.id === id)?.unit || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Crop Management</h1>
          <p className="text-muted-foreground">Define crops, growth stages, and sensor thresholds</p>
        </div>
        {canEdit && (
          <Dialog open={cropOpen} onOpenChange={setCropOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Crop</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Add New Crop</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Crop Name (e.g. Tomato)" value={cropForm.name} onChange={e => setCropForm({ ...cropForm, name: e.target.value })} />
                <Input placeholder="Category (e.g. Vegetables, Fruits)" value={cropForm.category} onChange={e => setCropForm({ ...cropForm, category: e.target.value })} />
                <Textarea placeholder="Description (optional)" value={cropForm.description} onChange={e => setCropForm({ ...cropForm, description: e.target.value })} />
                <Button onClick={addCrop} className="w-full">Add Crop</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(orgLoading || loading) && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass-card border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!orgLoading && !loading && crops.length === 0 && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Sprout className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No crops defined yet</p>
            <p className="text-sm">Add your first crop to define growth stages and sensor thresholds</p>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" className="space-y-4">
        {crops.map(crop => (
          <AccordionItem key={crop.id} value={crop.id} className="glass-card border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Sprout className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <span className="font-display font-semibold text-base">{crop.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary">{crop.category || "Uncategorized"}</Badge>
                    <span className="text-xs text-muted-foreground">{crop.crop_stages.length} stages</span>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              {crop.description && <p className="text-sm text-muted-foreground mb-4">{crop.description}</p>}

              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Growth Stages
                </h3>
                {canEdit && (
                  <Dialog open={stageOpen === crop.id} onOpenChange={open => setStageOpen(open ? crop.id : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" />Add Stage</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="font-display">Add Growth Stage</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <Input placeholder="Stage Name (e.g. Germination)" value={stageForm.name} onChange={e => setStageForm({ ...stageForm, name: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Order</label>
                            <Input type="number" placeholder="0, 1, 2..." value={stageForm.stage_order} onChange={e => setStageForm({ ...stageForm, stage_order: Number(e.target.value) })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Duration (days)</label>
                            <Input type="number" min={0} placeholder="e.g. 14" value={stageForm.duration_days} onChange={e => setStageForm({ ...stageForm, duration_days: Number(e.target.value) })} />
                          </div>
                        </div>
                        <Textarea placeholder="Description (optional)" value={stageForm.description} onChange={e => setStageForm({ ...stageForm, description: e.target.value })} />
                        <Button onClick={() => addStage(crop.id)} className="w-full">Add Stage</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {crop.crop_stages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No stages defined yet</p>
              )}

              <div className="space-y-3">
                {crop.crop_stages.map((stage, idx) => (
                  <Card key={stage.id} className="border">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{stage.stage_order}</Badge>
                          {stage.name}
                          <Badge variant="secondary" className="text-xs font-normal">{stage.duration_days || 0} days</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <>
                              <Dialog open={thresholdOpen === stage.id} onOpenChange={open => setThresholdOpen(open ? stage.id : null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="ghost"><Plus className="h-3 w-3 mr-1" />Threshold</Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle className="font-display">Add Sensor Threshold</DialogTitle></DialogHeader>
                                  <div className="space-y-4 pt-2">
                                     <select
                                       className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                       value={thresholdForm.metric}
                                       onChange={e => setThresholdForm({ ...thresholdForm, metric: e.target.value })}
                                     >
                                       <option value="">Select measured value</option>
                                       {SOIL_METRICS.filter(m => !stage.thresholds.some(t => t.metric === m.key)).map(m => (
                                         <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>
                                       ))}
                                     </select>
                                    <div className="grid grid-cols-2 gap-3">
                                      <Input type="number" placeholder="Min Value" value={thresholdForm.min_value} onChange={e => setThresholdForm({ ...thresholdForm, min_value: e.target.value })} />
                                      <Input type="number" placeholder="Max Value" value={thresholdForm.max_value} onChange={e => setThresholdForm({ ...thresholdForm, max_value: e.target.value })} />
                                    </div>
                                    <Button onClick={() => addThreshold(stage.id)} className="w-full">Add Threshold</Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button size="sm" variant="ghost" onClick={() => openEditStage(stage)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteStage(stage.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {stage.thresholds.length > 0 && (
                      <CardContent className="pt-0 px-4 pb-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Measured value</TableHead>
                              <TableHead className="text-xs">Min</TableHead>
                              <TableHead className="text-xs">Max</TableHead>
                              {canEdit && <TableHead className="text-xs w-10"></TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stage.thresholds.map(t => (
                              <TableRow key={t.id}>
                                <TableCell className="text-sm">{t.metric ? metricLabel(t.metric) : getSensorTypeName(t.sensor_type_id)}</TableCell>
                                <TableCell className="text-sm font-mono">{t.min_value ?? "—"} {t.metric ? metricUnit(t.metric) : getSensorTypeUnit(t.sensor_type_id)}</TableCell>
                                <TableCell className="text-sm font-mono">{t.max_value ?? "—"} {t.metric ? metricUnit(t.metric) : getSensorTypeUnit(t.sensor_type_id)}</TableCell>
                                {canEdit && (
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditThreshold(t)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={() => deleteThreshold(t.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>

              {canEdit && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditCrop(crop)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit Crop
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteCrop(crop.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete Crop
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Edit Crop */}
      <Dialog open={!!editCrop} onOpenChange={open => !open && setEditCrop(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Edit Crop</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Crop Name" value={editCropForm.name} onChange={e => setEditCropForm({ ...editCropForm, name: e.target.value })} />
            <Input placeholder="Category (e.g. Vegetables, Fruits)" value={editCropForm.category} onChange={e => setEditCropForm({ ...editCropForm, category: e.target.value })} />
            <Textarea placeholder="Description (optional)" value={editCropForm.description} onChange={e => setEditCropForm({ ...editCropForm, description: e.target.value })} />
            <Button onClick={saveCrop} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stage */}
      <Dialog open={!!editStage} onOpenChange={open => !open && setEditStage(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Edit Growth Stage</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Stage Name" value={editStageForm.name} onChange={e => setEditStageForm({ ...editStageForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Order</label>
                <Input type="number" value={editStageForm.stage_order} onChange={e => setEditStageForm({ ...editStageForm, stage_order: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Duration (days)</label>
                <Input type="number" min={0} value={editStageForm.duration_days} onChange={e => setEditStageForm({ ...editStageForm, duration_days: Number(e.target.value) })} />
              </div>
            </div>
            <Textarea placeholder="Description (optional)" value={editStageForm.description} onChange={e => setEditStageForm({ ...editStageForm, description: e.target.value })} />
            <Button onClick={saveStage} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Threshold */}
      <Dialog open={!!editThreshold} onOpenChange={open => !open && setEditThreshold(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Edit Threshold — {editThreshold?.metric ? metricLabel(editThreshold.metric) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Min Value{editThreshold?.metric ? ` (${metricUnit(editThreshold.metric)})` : ""}</label>
                <Input type="number" value={editThresholdForm.min_value} onChange={e => setEditThresholdForm({ ...editThresholdForm, min_value: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max Value{editThreshold?.metric ? ` (${metricUnit(editThreshold.metric)})` : ""}</label>
                <Input type="number" value={editThresholdForm.max_value} onChange={e => setEditThresholdForm({ ...editThresholdForm, max_value: e.target.value })} />
              </div>
            </div>
            <Button onClick={saveThreshold} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
