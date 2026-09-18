import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, Cpu } from "lucide-react";
import { toast } from "sonner";

type OrgSensor = {
  id: string;
  name: string;
  dev_eui: string | null;
  device_id: number | null;
  status: string;
  is_active: boolean;
  zone_name: string | null;
  type_name: string | null;
};

type OrgInfo = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  sensor_count: number;
  active_sensor_count: number;
  sensor_limit?: number;
};

export default function MasterAdminOrganisationDevicesPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [sensors, setSensors] = useState<OrgSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [overviewRes, sensorsRes] = await Promise.all([
          (supabase as any).rpc("master_admin_overview"),
          supabase.functions.invoke("master-admin-manage", {
            body: { action: "list_org_sensors", org_id: id },
          }),
        ]);
        const orgs = (overviewRes.data?.organizations as OrgInfo[]) || [];
        setOrg(orgs.find(o => o.id === id) || null);
        if (sensorsRes.error) throw new Error(sensorsRes.error.message);
        if (sensorsRes.data?.error) throw new Error(sensorsRes.data.error);
        setSensors((sensorsRes.data?.sensors as OrgSensor[]) || []);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const visibleSensors = showInactive ? sensors : sensors.filter(s => s.is_active !== false);
  const inactiveCount = sensors.filter(s => s.is_active === false).length;

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
          <Link to="/master-admin/organisations"><ArrowLeft className="mr-1 h-4 w-4" /> Back to organisations</Link>
        </Button>
        <div className="flex items-center gap-3">
          {org?.logo_url ? (
            <img src={org.logo_url} alt="" className="h-12 w-12 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {org ? `Devices — ${org.name}` : "Devices"}
            </h1>
            <p className="text-muted-foreground">
              {org ? `${org.sensor_count} of ${org.sensor_limit ?? 0} allowance used · ${org.active_sensor_count} active${inactiveCount ? ` · ${inactiveCount} inactive` : ""}` : "All devices registered to this organisation"}
            </p>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="font-display text-lg">Registered devices</CardTitle>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={showInactive} onCheckedChange={v => setShowInactive(v === true)} />
            Show inactive{inactiveCount ? ` (${inactiveCount})` : ""}
          </label>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px]" />
          ) : visibleSensors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Cpu className="h-8 w-8" />
              <p className="text-sm">{sensors.length ? "No active devices — tick \"Show inactive\" to see all" : "No devices registered yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Device ID / EUI</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Connection</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSensors.map(s => (
                    <TableRow key={s.id} className={s.is_active === false ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.type_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.dev_eui ?? (s.device_id != null ? `ID ${s.device_id}` : "—")}
                      </TableCell>
                      <TableCell><Badge variant="outline">{s.zone_name ?? "No zone"}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={s.status === "online" ? "border-emerald-500/30 text-emerald-500" : undefined}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.is_active === false
                          ? <Badge variant="outline" className="border-destructive/40 text-destructive">Inactive</Badge>
                          : <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">Active</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </MasterAdminLayout>
  );
}
