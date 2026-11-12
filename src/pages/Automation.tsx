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
import { Bell, Power, Square, RefreshCw, Check, Activity, AlertTriangle, MapPin, Clock, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { alertsForAppliance, canControlAutomation } from "@/lib/automation";


const db = supabase as any;

export default function AutomationPage() {
  const { currentOrg, currentRole } = useOrg();
  const { isMasterAdmin } = useAuth();
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
  };


  const controls = (appliance: any, alertId?: string) => canControl && (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || commands.some(c => c.appliance_id === appliance.id && c.status === "pending")} onClick={() => setAction({ appliance, command: "on", alertId })}><Power className="mr-2 h-4 w-4" />Turn on</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction({ appliance, command: "off", alertId })}><Square className="mr-2 h-4 w-4" />Turn off</Button>
    </div>
  );

  const apName = (id: string) => appliances.find(a => a.id === id)?.name || "—";
  const statusVariant = (s: string) => (s === "failed" ? "destructive" : s === "sent" ? "default" : "secondary") as any;
  const latest = (id: string) => commands.find(c => c.appliance_id === id);
  const isRunning = (a: any) => {
    const c = latest(a.id);
    return c?.command === "on" && c.status !== "failed" && Date.now() < new Date(c.execute_at).getTime() + a.max_run_s * 1000;
  };
  const runningCount = appliances.filter(isRunning).length;
  const unreadCount = alerts.filter(a => !a.is_read && appliances.some(ap => ap.zone_id && ap.zone_id === a.sensors?.zone_id)).length;
  const failedCount = commands.filter(c => c.status === "failed").length;
  const stats = [
    { label: "Appliances", value: appliances.length, icon: Zap, tone: "text-primary" },
    { label: "Running now", value: runningCount, icon: Activity, tone: "text-success" },
    { label: "Zone alerts unread", value: unreadCount, icon: Bell, tone: "text-warning" },
    { label: "Failed commands", value: failedCount, icon: AlertTriangle, tone: "text-destructive" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">Automation</h1>
          <p className="text-muted-foreground">Control zone appliances and respond to alerts</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading || busy} onClick={() => setRefresh(v => v + 1)}>
          <RefreshCw className={cn("h-4 w-4 sm:mr-2", loading && "animate-spin")} /><span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label} className="min-w-0">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-muted p-2"><s.icon className={cn("h-5 w-5", s.tone)} /></div>
              <div className="min-w-0"><p className="text-2xl font-bold leading-none">{loading ? "–" : s.value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="automations">
        <div className="overflow-x-auto"><TabsList>
          <TabsTrigger value="automations">Automations ({appliances.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent activity ({commands.length})</TabsTrigger>
        </TabsList></div>
        <TabsContent value="automations" className="mt-4">
      {loading ? <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div> : appliances.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground"><Zap className="h-8 w-8" />No automations configured for this organisation yet</CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {appliances.map(a => {
            const running = isRunning(a);
            const last = latest(a.id);
            const zoneAlerts = alertsForAppliance<any>(alerts, a.zone_id);
            const pending = commands.some(c => c.appliance_id === a.id && c.status === "pending");
            return (
            <Card key={a.id} className={cn("min-w-0 overflow-hidden transition-shadow hover:shadow-md", running && "border-success/60")}>
              <div className={cn("h-1", running ? "bg-success" : "bg-muted")} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn("rounded-full p-2", running ? "bg-success/15" : "bg-muted")}><Zap className={cn("h-5 w-5", running ? "text-success" : "text-muted-foreground")} /></div>
                    <div className="min-w-0">
                      <CardTitle className="truncate font-display text-lg">{a.name}</CardTitle>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{a.zones?.name || "No zone"}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 gap-1.5", running ? "border-success text-success" : pending ? "border-warning text-warning" : "")}>
                    <span className={cn("h-2 w-2 rounded-full", running ? "animate-pulse bg-success" : pending ? "bg-warning" : "bg-muted-foreground")} />
                    {running ? "Running" : pending ? "Pending" : "Idle"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
                  <div className="min-w-0"><p className="text-[11px] text-muted-foreground">Controller</p><p className="truncate text-xs font-medium" title={a.controller_dev_eui}>{a.controller_dev_eui}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Output</p><p className="text-xs font-medium">{a.do_channel}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Max run</p><p className="text-xs font-medium">{a.max_run_s}s</p></div>
                </div>
                {controls(a)}
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{last ? <>Last: <span className="uppercase">{last.command}</span> · <span className="capitalize">{last.status}</span> · {new Date(last.execute_at).toLocaleString()}</> : "No commands yet"}</p>
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rules</h3>
                  {(a.appliance_rules || []).map((r: any) => (
                    <div key={r.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      {r.condition === "above_max" ? <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                      <div className="min-w-0"><p className="font-medium">When {metricLabel(r.metric)} is {r.condition === "above_max" ? "too high" : "too low"}</p>
                      <p className="text-xs text-muted-foreground">Run {r.run_seconds}s · cooldown {r.cooldown_min} min</p></div>
                    </div>
                  ))}
                  {!a.appliance_rules?.length && <p className="text-sm text-muted-foreground">No rules</p>}
                </div>
                <Collapsible defaultOpen={zoneAlerts.some(x => !x.is_read)} className="rounded-lg border">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-3 text-sm font-medium">
                    <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-warning" />Zone alerts
                      {zoneAlerts.filter(x => !x.is_read).length > 0 && <Badge variant="destructive" className="h-5 px-1.5">{zoneAlerts.filter(x => !x.is_read).length} new</Badge>}
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="max-h-80 overflow-y-auto border-t px-3">
                   {zoneAlerts.map(alert => (
                     <div key={alert.id} className={cn("space-y-2 border-b py-3 last:border-b-0", alert.is_read && "opacity-60")}>
                       <div className="flex items-start justify-between gap-2">
                         <div className="min-w-0"><p className="break-words text-sm font-medium">{alert.title}</p><p className="text-xs text-muted-foreground">{alert.sensors?.name} · {new Date(alert.created_at).toLocaleString()}</p></div>
                         <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"} className="capitalize">{alert.severity}</Badge>
                       </div>
                       <p className="break-words text-sm text-muted-foreground">{alert.message}</p>
                       <div className="flex flex-wrap items-center gap-2">{controls(a, alert.id)}{!alert.is_read && <Button size="sm" variant="ghost" onClick={() => markRead(alert.id)}><Check className="mr-1 h-4 w-4" />Mark read</Button>}</div>
                     </div>
                   ))}
                   {!zoneAlerts.length && <p className="py-3 text-sm text-muted-foreground">No recent alerts in this zone</p>}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );})}
        </div>
      )}
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
      <Card className="min-w-0">
        <CardHeader><CardTitle className="font-display text-lg">Recent activity</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Appliance</TableHead><TableHead>Zone</TableHead><TableHead>Action</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {commands.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{new Date(c.execute_at).toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{apName(c.appliance_id)}</TableCell><TableCell>{appliances.find(a => a.id === c.appliance_id)?.zones?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("uppercase", c.command === "on" ? "border-success text-success" : "")}>{c.command}</Badge></TableCell>
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
