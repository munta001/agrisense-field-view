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
import { Plus, Building2 } from "lucide-react";
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
  users: unknown[];
};

export default function MasterAdminOrganisationsPage() {
  const { isMasterAdmin } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  const [togglingId, setTogglingId] = useState<string | null>(null);

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map(o => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {o.logo_url ? (
                            <img src={o.logo_url} alt={`${o.name} logo`} className="h-7 w-7 rounded object-cover" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                          <span className="font-medium">{o.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{o.users.length}</TableCell>
                      <TableCell>
                        {o.sensor_count} <Badge variant="outline" className="ml-1">{o.active_sensor_count} active</Badge>
                      </TableCell>
                      <TableCell>{o.zone_count}</TableCell>
                      <TableCell>{o.reading_count}</TableCell>
                      <TableCell>{formatBytes(Number(o.storage_bytes || 0))} · {o.storage_files} files</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy")}</TableCell>
                    </TableRow>
                  ))}
                  {!orgs.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No organisations yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </MasterAdminLayout>
  );
}
