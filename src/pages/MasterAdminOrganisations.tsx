import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { formatBytes } from "@/pages/MasterAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Org = {
  id: string;
  name: string;
  slug: string;
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

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc("master_admin_overview");
    setOrgs((data?.organizations as Org[]) || []);
    setLoading(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New organisation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create organisation</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name</Label>
                <Input id="org-name" value={name} onChange={e => setName(e.target.value)} placeholder="Green Valley Farm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Short code (optional)</Label>
                <Input id="org-slug" value={slug} onChange={e => setSlug(e.target.value)} placeholder="green-valley-farm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createOrg} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                      <TableCell className="font-medium">{o.name}</TableCell>
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
