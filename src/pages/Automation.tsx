import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap } from "lucide-react";
import { metricLabel } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bell, Power, Square, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAlertNotifications } from "@/hooks/use-alert-notifications";
import { alertsForAppliance, canControlAutomation } from "@/lib/automation";

const db = supabase as any;

export default function AutomationPage() {
  const { currentOrg, currentRole } = useOrg();
  const { isMasterAdmin } = useAuth();
  const { refreshNotifications } = useAlertNotifications();
  const [appliances, setAppliances] = useState<any[]>([]);
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [action, setAction] = useState<{ appliance: any; command: "on" | "off"; alertId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const canControl = canControlAutomation(currentRole?.role, isMasterAdmin);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    setAppliances([]); setCommands([]); setAlerts([]); setAction(null); setLoading(true);
    const load = async () => {
      try {
      const [{ data: a, error: applianceError }, { data: al, error: alertError }] = await Promise.all([
        db.from("appliances").select("*, appliance_rules(*), zones(name)").eq("org_id", currentOrg.id).order("name"),
        db.from("alerts").select("*, sensors(name, zone_id)").eq("org_id", currentOrg.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (applianceError || alertError) throw applianceError || alertError;
      const ids = (a || []).map((x: any) => x.id);
      const { data: c, error: commandError } = ids.length
        ? await db.from("automation_commands").select("*").in("appliance_id", ids).order("execute_at", { ascending: false }).limit(50)
        : { data: [] };
      if (commandError) throw commandError;
      if (!cancelled) { setAppliances(a || []); setCommands(c || []); setAlerts(al || []); }
      } catch { if (!cancelled) toast.error("Could not load automation. Please refresh."); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [currentOrg?.id, refresh]);

  const execute = async () => {
    if (!action || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manual-automation", { body: { appliance_id: action.appliance.id, command: action.command, ...(action.alertId ? { alert_id: action.alertId } : {}) } });
      if (error || data?.error) {
        let message = data?.error || "Could not submit the command. Please try again.";
        if (error && "context" in error) { try { message = (await error.context.json()).error || message; } catch { /* Keep friendly fallback. */ } }
        throw new Error(message);
      }
      if (data.status === "failed") toast.error("Publish failed. Check Recent activity for details.");
      else toast.success(data.status === "sent" ? "Command published to the controller gateway" : "Command queued for dispatch");
      setAction(null); setRefresh(value => value + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Command failed"); }
    finally { setBusy(false); }
  };

  const markRead = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    if (error) { toast.error("Could not mark alert as read"); return; }
    setAlerts(items => items.map(item => item.id === id ? { ...item, is_read: true } : item));
    refreshNotifications();
  };

  const controls = (appliance: any, alertId?: string) => canControl && (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || commands.some(c => c.appliance_id === appliance.id && c.status === "pending")} onClick={() => setAction({ appliance, command: "on", alertId })}><Power className="mr-2 h-4 w-4" />Turn on</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction({ appliance, command: "off", alertId })}><Square className="mr-2 h-4 w-4" />Turn off</Button>
    </div>
  );

  const apName = (id: string) => appliances.find(a => a.id === id)?.name || "—";
  const statusVariant = (s: string) => (s === "failed" ? "destructive" : s === "sent" ? "default" : "secondary") as any;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
        <h1 className="font-display text-2xl font-bold">Automation</h1>
        <p className="text-muted-foreground">Zone controllers and recent alerts</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Refresh automation" disabled={loading || busy} onClick={() => setRefresh(v => v + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Tabs defaultValue="automations">
        <TabsList>
          <TabsTrigger value="automations">Automations ({appliances.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent activity ({commands.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="automations" className="mt-4">
      {loading ? <Skeleton className="h-40 w-full" /> : appliances.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No automations configured for this organisation yet</CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {appliances.map(a => (
            <Card key={a.id} className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg"><Zap className="h-4 w-4 text-primary" />{a.name}</CardTitle>
                <div><Badge variant="outline" className="mt-1">Zone: {a.zones?.name || "No zone"}</Badge></div>
                <p className="break-all text-xs text-muted-foreground">Controller {a.controller_dev_eui} · Output {a.do_channel} · Max {a.max_run_s}s per run</p>
              </CardHeader>
              <CardContent className="space-y-2">
                 {controls(a)}
                 <p className="text-xs text-muted-foreground">{commands.find(c => c.appliance_id === a.id) ? `Latest command: ${commands.find(c => c.appliance_id === a.id)?.command} · ${commands.find(c => c.appliance_id === a.id)?.status}` : "No commands yet"}</p>
                {(a.appliance_rules || []).map((r: any) => (
                  <div key={r.id} className="rounded-md border p-2 text-sm">
                    <span className="font-medium">When {metricLabel(r.metric)} is {r.condition === "above_max" ? "too high" : "too low"}</span>
                    <p className="text-xs text-muted-foreground">Switch on for {r.run_seconds}s · then wait {r.cooldown_min} min</p>
                  </div>
                ))}
                {!a.appliance_rules?.length && <p className="text-sm text-muted-foreground">No rules</p>}
                 <div className="border-t pt-3">
                   <h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4 text-warning" />Recent zone alerts</h3>
                   {alertsForAppliance<any>(alerts, a.zone_id).map(alert => (
                     <div key={alert.id} className="space-y-2 border-b py-3 last:border-b-0">
                       <div className="flex items-start justify-between gap-2">
                         <div className="min-w-0"><p className="break-words text-sm font-medium">{alert.title}</p><p className="text-xs text-muted-foreground">{alert.sensors?.name} · {new Date(alert.created_at).toLocaleString()}</p></div>
                         <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                       </div>
                       <p className="break-words text-sm text-muted-foreground">{alert.message}</p>
                       <div className="flex flex-wrap items-center gap-2">{controls(a, alert.id)}{!alert.is_read && <Button size="sm" variant="ghost" onClick={() => markRead(alert.id)}><Check className="mr-1 h-4 w-4" />Mark read</Button>}</div>
                     </div>
                   ))}
                   {!alertsForAppliance<any>(alerts, a.zone_id).length && <p className="text-sm text-muted-foreground">No recent alerts in this zone</p>}
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Recent activity</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Appliance</TableHead><TableHead>Zone</TableHead><TableHead>Action</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {commands.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{new Date(c.execute_at).toLocaleString()}</TableCell>
                  <TableCell>{apName(c.appliance_id)}</TableCell><TableCell>{appliances.find(a => a.id === c.appliance_id)?.zones?.name || "—"}</TableCell>
                  <TableCell className="uppercase">{c.command}</TableCell>
                  <TableCell className="capitalize">{c.source}</TableCell>
                   <TableCell><Badge variant={statusVariant(c.status)} className="capitalize">{c.status}</Badge>{c.error && <p className="mt-1 max-w-xs break-words text-xs text-destructive">{c.error}</p>}</TableCell>
                </TableRow>
              ))}
              {!loading && commands.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No automation activity yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!action} onOpenChange={open => { if (!open && !busy) setAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Turn {action?.command} {action?.appliance.name}?</AlertDialogTitle><AlertDialogDescription>
            Zone: {action?.appliance.zones?.name || "No zone"}. {action?.command === "on" ? `A stop command will be scheduled after ${action.appliance.max_run_s} seconds. Published commands do not confirm the physical controller state.` : "This sends a stop command and cancels any queued start for this appliance."}
          </AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); execute(); }}>{busy ? "Submitting…" : `Turn ${action?.command}`}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
