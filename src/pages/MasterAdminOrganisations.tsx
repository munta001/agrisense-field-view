import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { formatBytes } from "@/pages/MasterAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Building2, Pencil, Power, PowerOff, Loader2, Eye, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Org = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  sensor_count: number;
  active_sensor_count: number;
  zone_count: number;
  reading_count: number;
  storage_bytes: number;
  storage_files: number;
  readings_bytes?: number;
  sensor_limit?: number;
  zone_limit?: number;

  users: unknown[];
};

export default function MasterAdminOrganisationsPage() {
  const { isMasterAdmin } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [viewingOrg, setViewingOrg] = useState<Org | null>(null);
  const [copied, setCopied] = useState(false);
  const [sensorsOpen, setSensorsOpen] = useState(false);
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [sensors, setSensors] = useState<OrgSensor[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  const visibleSensors = showInactive ? sensors : sensors.filter(s => s.is_active !== false);

  const closeView = () => {
    setViewingOrg(null);
    setSensorsOpen(false);
    setSensors([]);
    setShowInactive(false);
  };

  const loadSensors = async (orgId: string) => {
    setSensorsOpen(true);
    setSensorsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("master-admin-manage", {
        body: { action: "list_org_sensors", org_id: orgId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSensors((data?.sensors as OrgSensor[]) || []);
    } catch (err) {
      toast.error((err as Error).message);
      setSensors([]);
    } finally {
      setSensorsLoading(false);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Internal ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy ID");
    }
  };

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc("master_admin_overview");
    setOrgs((data?.organizations as Org[]) || []);
    setLoading(false);
  };

  const toggleActive = async (org: Org) => {
    setTogglingId(org.id);
    try {
      const { data, error } = await supabase.functions.invoke("master-admin-manage", {
        body: { action: "set_org_active", org_id: org.id, active: !org.is_active },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(org.is_active ? `${org.name} deactivated` : `${org.name} activated`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    if (isMasterAdmin) load();
  }, [isMasterAdmin]);

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Organisations</h1>
          <p className="text-muted-foreground">Create organisations and review their usage</p>
        </div>
        <Button className="w-full sm:w-auto" asChild>
          <Link to="/master-admin/organisations/new"><Plus className="mr-2 h-4 w-4" /> New organisation</Link>
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">All organisations</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Zones</TableHead>
                    <TableHead>Readings</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map(o => (
                    <TableRow key={o.id} className={!o.is_active ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {o.logo_url ? (
                            <img src={o.logo_url} alt={`${o.name} logo`} className="h-7 w-7 rounded object-cover" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                          <div>
                            <span className="font-medium">{o.name}</span>
                            <p className="text-xs text-muted-foreground">{o.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{o.users.length}</TableCell>
                      <TableCell>
                        {o.sensor_count} / {o.sensor_limit ?? 0}{" "}
                        <Badge variant="outline" className="ml-1">{o.active_sensor_count} active</Badge>
                      </TableCell>
                      <TableCell>{o.zone_count} / {o.zone_limit ?? 0}</TableCell>
                      <TableCell>{o.reading_count}</TableCell>
                      <TableCell>
                        {formatBytes(Number(o.storage_bytes || 0))}
                        <span className="block text-xs text-muted-foreground">
                          {o.storage_files} files + {(Number(o.reading_count || 0)).toLocaleString()} readings ({formatBytes(Number(o.readings_bytes || 0))})
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        {o.is_active
                          ? <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">Active</Badge>
                          : <Badge variant="outline" className="border-destructive/40 text-destructive">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewingOrg(o)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> View
                          </Button>
                          <Button
                            variant={o.is_active ? "destructive" : "outline"}
                            size="sm"
                            disabled={togglingId === o.id}
                            onClick={() => toggleActive(o)}
                          >
                            {togglingId === o.id
                              ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              : o.is_active ? <PowerOff className="mr-1 h-3.5 w-3.5" /> : <Power className="mr-1 h-3.5 w-3.5" />}
                            {o.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!orgs.length && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No organisations yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingOrg} onOpenChange={open => { if (!open) setViewingOrg(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Organisation details</DialogTitle>
            <DialogDescription>{viewingOrg?.name}</DialogDescription>
          </DialogHeader>
          {viewingOrg && (
            <div className="space-y-5 py-2">
              <div className="flex items-center gap-3">
                {viewingOrg.logo_url ? (
                  <img src={viewingOrg.logo_url} alt="" className="h-14 w-14 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-muted">
                    <Building2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-display text-lg font-semibold">{viewingOrg.name}</p>
                  <p className="text-sm text-muted-foreground">{viewingOrg.slug}</p>
                </div>
                {viewingOrg.is_active
                  ? <Badge className="ml-auto border-emerald-500/30 bg-emerald-500/15 text-emerald-400">Active</Badge>
                  : <Badge variant="outline" className="ml-auto border-destructive/40 text-destructive">Inactive</Badge>}
              </div>

              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Internal ID</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-sm font-medium">{viewingOrg.id}</code>
                  <Button variant="secondary" size="sm" onClick={() => copyId(viewingOrg.id)}>
                    {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Users</p>
                  <p className="mt-1 text-lg font-semibold">{viewingOrg.users.length}</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadSensors(viewingOrg.id)}
                  className="rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Devices</p>
                  <p className="mt-1 text-lg font-semibold">{viewingOrg.sensor_count} / {viewingOrg.sensor_limit ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{viewingOrg.active_sensor_count} active · click to view</p>
                </button>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Zones</p>
                  <p className="mt-1 text-lg font-semibold">{viewingOrg.zone_count} / {viewingOrg.zone_limit ?? 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Readings</p>
                  <p className="mt-1 text-lg font-semibold">{viewingOrg.reading_count.toLocaleString()}</p>
                </div>
              </div>

              {sensorsOpen && (
                <div className="rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                    <p className="font-display text-sm font-semibold">Devices in {viewingOrg.name}</p>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={showInactive} onCheckedChange={v => setShowInactive(v === true)} />
                      Show inactive
                    </label>
                  </div>
                  {sensorsLoading ? (
                    <div className="p-4"><Skeleton className="h-24" /></div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {visibleSensors.length === 0 ? (
                        <p className="p-4 text-center text-sm text-muted-foreground">No devices to show</p>
                      ) : (
                        <ul className="divide-y">
                          {visibleSensors.map(s => (
                            <li key={s.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                              <div className="min-w-[140px] flex-1">
                                <p className="font-medium">{s.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {s.type_name ?? "Device"}{s.dev_eui ? ` · ${s.dev_eui}` : s.device_id ? ` · ID ${s.device_id}` : ""}
                                </p>
                              </div>
                              <Badge variant="outline">{s.zone_name ?? "No zone"}</Badge>
                              <Badge variant="outline" className={s.status === "online" ? "border-emerald-500/30 text-emerald-500" : undefined}>
                                {s.status}
                              </Badge>
                              {s.is_active === false && (
                                <Badge variant="outline" className="border-destructive/40 text-destructive">Inactive</Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}



              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Storage: <span className="font-medium text-foreground">{formatBytes(Number(viewingOrg.storage_bytes || 0))}</span></p>
                <p>Created: <span className="font-medium text-foreground">{format(new Date(viewingOrg.created_at), "dd MMM yyyy")}</span></p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setViewingOrg(null)}>Close</Button>
                <Button asChild>
                  <Link to={`/master-admin/organisations/${viewingOrg.id}/edit`} onClick={() => setViewingOrg(null)}>Edit organisation</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MasterAdminLayout>
  );
}
