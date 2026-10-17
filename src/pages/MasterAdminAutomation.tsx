import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { SOIL_METRICS, metricLabel, metricUnit } from "@/lib/metrics";

const db = supabase as any;
const emptyAp = { name: "", zone_id: "", controller_dev_eui: "", do_channel: "", max_run_s: "600" };
const emptyRule = { metric: "temperature_c", condition: "above_max", run_seconds: "300", cooldown_min: "30" };

export default function MasterAdminAutomationPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgId, setOrgId] = useState("");
  const [zones, setZones] = useState<any[]>([]);
  const [appliances, setAppliances] = useState<any[]>([]);
  const [apOpen, setApOpen] = useState(false);
  const [apEdit, setApEdit] = useState<any>(null);
  const [apForm, setApForm] = useState(emptyAp);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleAp, setRuleAp] = useState<any>(null);
  const [ruleEdit, setRuleEdit] = useState<any>(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.rpc("master_admin_overview").then(({ data, error }: any) => {
      if (error) { toast.error(error.message); return; }
      const list = (data?.organizations || []).map((o: any) => ({ id: o.id, name: o.name }));
      setOrgs(list);
      if (list[0]) setOrgId(list[0].id);
    });
  }, []);

  const load = async () => {
    if (!orgId) return;
    const [{ data: z }, { data: a }] = await Promise.all([
      db.from("zones").select("id,name").eq("org_id", orgId).order("name"),
      db.from("appliances").select("*, appliance_rules(*)").eq("org_id", orgId).order("name"),
    ]);
    setZones(z || []); setAppliances(a || []);
  };
  useEffect(() => { load(); }, [orgId]);

  const zoneName = (id: string) => zones.find(z => z.id === id)?.name || "No zone";

  const openAp = (a?: any) => {
    setApEdit(a || null);
    setApForm(a ? { name: a.name, zone_id: a.zone_id || "", controller_dev_eui: a.controller_dev_eui, do_channel: a.do_channel, max_run_s: String(a.max_run_s) } : emptyAp);
    setApOpen(true);
  };
  const saveAp = async () => {
    if (!apForm.name.trim() || !apForm.zone_id || !apForm.controller_dev_eui.trim() || !apForm.do_channel.trim()) { toast.error("Name, zone, controller and output channel are required"); return; }
    const max = parseInt(apForm.max_run_s);
    if (!(max > 0)) { toast.error("Maximum run time must be above 0"); return; }
    setSaving(true);
    const payload = { org_id: orgId, name: apForm.name.trim(), zone_id: apForm.zone_id, controller_dev_eui: apForm.controller_dev_eui.trim(), do_channel: apForm.do_channel.trim(), max_run_s: max };
    const { error } = apEdit ? await db.from("appliances").update(payload).eq("id", apEdit.id) : await db.from("appliances").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Appliance saved"); setApOpen(false); load();
  };
  const removeAp = async (a: any) => {
    if (!confirm(`Delete appliance "${a.name}" and its rules?`)) return;
    await db.from("appliance_rules").delete().eq("appliance_id", a.id);
    const { error } = await db.from("appliances").delete().eq("id", a.id);
    if (error) { toast.error(error.message.includes("foreign key") ? "This appliance has command history and cannot be deleted" : error.message); load(); return; }
    toast.success("Appliance deleted"); load();
  };

  const openRule = (ap: any, r?: any) => {
    setRuleAp(ap); setRuleEdit(r || null);
    setRuleForm(r ? { metric: r.metric, condition: r.condition, run_seconds: String(r.run_seconds), cooldown_min: String(r.cooldown_min) } : emptyRule);
    setRuleOpen(true);
  };
  const saveRule = async () => {
    const run = parseInt(ruleForm.run_seconds), cool = parseInt(ruleForm.cooldown_min);
    if (!(run > 0) || !(cool >= 0)) { toast.error("Run time must be above 0 and cooldown 0 or more"); return; }
    setSaving(true);
    const payload = { appliance_id: ruleAp.id, metric: ruleForm.metric, condition: ruleForm.condition, run_seconds: run, cooldown_min: cool };
    const { error } = ruleEdit ? await db.from("appliance_rules").update(payload).eq("id", ruleEdit.id) : await db.from("appliance_rules").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule saved"); setRuleOpen(false); load();
  };
  const removeRule = async (r: any) => {
    if (!confirm("Delete this rule?")) return;
    const { error } = await db.from("appliance_rules").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule deleted"); load();
  };

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Automation</h1>
          <p className="text-muted-foreground">Define which appliances switch on when a zone's readings go out of range</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="Organisation" /></SelectTrigger>
            <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => openAp()} disabled={!orgId}><Plus className="mr-2 h-4 w-4" />New appliance</Button>
        </div>
      </div>

      {appliances.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No appliances for this organisation yet</CardContent></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {appliances.map(a => (
          <Card key={a.id} className="min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 font-display text-lg"><Zap className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{a.name}</span></CardTitle>
                <Badge variant="outline" className="mt-1">Zone: {zoneName(a.zone_id)}</Badge>
                <p className="mt-1 break-all text-xs text-muted-foreground">Controller {a.controller_dev_eui} · Output {a.do_channel} · Max {a.max_run_s}s</p>
              </div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon" aria-label="Edit appliance" onClick={() => openAp(a)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete appliance" onClick={() => removeAp(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(a.appliance_rules || []).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">When {metricLabel(r.metric)} is {r.condition === "above_max" ? "above" : "below"} range</span>
                    <p className="text-xs text-muted-foreground">Run {r.run_seconds}s · wait {r.cooldown_min} min before repeating</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Edit rule" onClick={() => openRule(a, r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete rule" onClick={() => removeRule(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
              {!a.appliance_rules?.length && <p className="text-sm text-muted-foreground">No rules yet</p>}
              <Button variant="outline" size="sm" onClick={() => openRule(a)}><Plus className="mr-2 h-4 w-4" />Add rule</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={apOpen} onOpenChange={setApOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{apEdit ? "Edit appliance" : "New appliance"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={apForm.name} maxLength={100} placeholder="Irrigation pump" onChange={e => setApForm({ ...apForm, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Activate in zone</Label>
              <Select value={apForm.zone_id} onValueChange={v => setApForm({ ...apForm, zone_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select the zone this automation controls" /></SelectTrigger>
                <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Controller device EUI</Label><Input value={apForm.controller_dev_eui} maxLength={32} onChange={e => setApForm({ ...apForm, controller_dev_eui: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Output channel (hex)</Label><Input value={apForm.do_channel} maxLength={8} placeholder="0700" onChange={e => setApForm({ ...apForm, do_channel: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max run (seconds)</Label><Input type="number" min={1} value={apForm.max_run_s} onChange={e => setApForm({ ...apForm, max_run_s: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApOpen(false)}>Cancel</Button>
            <Button onClick={saveAp} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ruleEdit ? "Edit rule" : "New rule"} — {ruleAp?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Reading</Label>
                <Select value={ruleForm.metric} onValueChange={v => setRuleForm({ ...ruleForm, metric: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOIL_METRICS.map(m => <SelectItem key={m.key} value={m.key}>{m.label} ({metricUnit(m.key)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>When</Label>
                <Select value={ruleForm.condition} onValueChange={v => setRuleForm({ ...ruleForm, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above_max">Above crop stage maximum</SelectItem>
                    <SelectItem value="below_min">Below crop stage minimum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Run for (seconds)</Label><Input type="number" min={1} value={ruleForm.run_seconds} onChange={e => setRuleForm({ ...ruleForm, run_seconds: e.target.value })} /></div>
              <div className="space-y-1"><Label>Cooldown (minutes)</Label><Input type="number" min={0} value={ruleForm.cooldown_min} onChange={e => setRuleForm({ ...ruleForm, cooldown_min: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Ranges come from the zone's current crop stage thresholds. Run time is capped by the appliance's maximum.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button onClick={saveRule} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MasterAdminLayout>
  );
}
