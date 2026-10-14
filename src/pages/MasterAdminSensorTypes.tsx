import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ST = Tables<"sensor_types">;
const empty = { name: "", unit: "", description: "", min_value: "", max_value: "" };

export default function MasterAdminSensorTypesPage() {
  const [types, setTypes] = useState<ST[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ST | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => supabase.from("sensor_types").select("*").order("name").then(({ data }) => setTypes(data || []));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (t: ST) => {
    setEditing(t);
    setForm({ name: t.name, unit: t.unit, description: t.description ?? "", min_value: t.min_value?.toString() ?? "", max_value: t.max_value?.toString() ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.unit.trim()) { toast.error("Name and unit are required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(), unit: form.unit.trim(), description: form.description.trim() || null,
      min_value: form.min_value === "" ? null : Number(form.min_value),
      max_value: form.max_value === "" ? null : Number(form.max_value),
    };
    const { error } = editing
      ? await supabase.from("sensor_types").update(payload).eq("id", editing.id)
      : await supabase.from("sensor_types").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Sensor type updated" : "Sensor type created");
    setOpen(false); load();
  };

  const remove = async (t: ST) => {
    if (!confirm(`Delete sensor type "${t.name}"?`)) return;
    const { error } = await supabase.from("sensor_types").delete().eq("id", t.id);
    if (error) { toast.error(error.message.includes("foreign key") ? "This type is used by devices and cannot be deleted" : error.message); return; }
    toast.success("Sensor type deleted"); load();
  };

  return (
    <MasterAdminLayout>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Sensor types</h1>
          <p className="text-muted-foreground">Sensor types available to every organisation</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New sensor type</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">All sensor types</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Unit</TableHead><TableHead>Range</TableHead>
                <TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.unit}</TableCell>
                  <TableCell className="font-mono">{t.min_value ?? "—"} – {t.max_value ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No sensor types yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit sensor type" : "New sensor type"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} maxLength={100} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Unit</Label><Input value={form.unit} maxLength={30} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Min value</Label><Input type="number" value={form.min_value} onChange={e => setForm({ ...form, min_value: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max value</Label><Input type="number" value={form.max_value} onChange={e => setForm({ ...form, max_value: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} maxLength={500} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MasterAdminLayout>
  );
}
