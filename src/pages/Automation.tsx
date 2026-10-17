import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap } from "lucide-react";
import { metricLabel } from "@/lib/metrics";

const db = supabase as any;

export default function AutomationPage() {
  const { currentOrg } = useOrg();
  const [appliances, setAppliances] = useState<any[]>([]);
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    (async () => {
      const { data: a } = await db.from("appliances").select("*, appliance_rules(*), zones(name)").eq("org_id", currentOrg.id).order("name");
      const ids = (a || []).map((x: any) => x.id);
      const { data: c } = ids.length
        ? await db.from("automation_commands").select("*").in("appliance_id", ids).order("execute_at", { ascending: false }).limit(50)
        : { data: [] };
      setAppliances(a || []); setCommands(c || []); setLoading(false);
    })();
  }, [currentOrg?.id]);

  const apName = (id: string) => appliances.find(a => a.id === id)?.name || "—";
  const statusVariant = (s: string) => (s === "failed" ? "destructive" : s === "sent" ? "default" : "secondary") as any;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Automation</h1>
        <p className="text-muted-foreground">Appliances that switch on automatically when readings leave the crop range. Set up by the platform administrator.</p>
      </div>

      {loading ? <Skeleton className="h-40 w-full" /> : appliances.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No automations configured for this organisation yet</CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {appliances.map(a => (
            <Card key={a.id} className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg"><Zap className="h-4 w-4 text-primary" />{a.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{a.zones?.name || "No zone"} · max {a.max_run_s}s per run</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {(a.appliance_rules || []).map((r: any) => (
                  <div key={r.id} className="rounded-md border p-2 text-sm">
                    <span className="font-medium">When {metricLabel(r.metric)} is {r.condition === "above_max" ? "too high" : "too low"}</span>
                    <p className="text-xs text-muted-foreground">Switch on for {r.run_seconds}s · then wait {r.cooldown_min} min</p>
                  </div>
                ))}
                {!a.appliance_rules?.length && <p className="text-sm text-muted-foreground">No rules</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Recent activity</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Appliance</TableHead><TableHead>Action</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {commands.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{new Date(c.execute_at).toLocaleString()}</TableCell>
                  <TableCell>{apName(c.appliance_id)}</TableCell>
                  <TableCell className="uppercase">{c.command}</TableCell>
                  <TableCell className="capitalize">{c.source}</TableCell>
                  <TableCell><Badge variant={statusVariant(c.status)} className="capitalize">{c.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!loading && commands.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No automation activity yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
