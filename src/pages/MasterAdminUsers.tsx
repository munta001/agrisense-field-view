import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type PlatformUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  org_id: string | null;
  org_name: string | null;
  role: string | null;
  is_active: boolean;
};

type Org = { id: string; name: string };

const NONE = "__none__";

export default function MasterAdminUsersPage() {
  const { isMasterAdmin } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [orgId, setOrgId] = useState<string>(NONE);
  const [role, setRole] = useState("viewer");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("master-admin-manage", {
      body: { action: "list_users" },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not load users");
    } else {
      setUsers((data as any).users || []);
      setOrgs((data as any).organizations || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isMasterAdmin) load();
  }, [isMasterAdmin]);

  const openEdit = (u: PlatformUser) => {
    setEditing(u);
    setOrgId(u.org_id ?? NONE);
    setRole(u.role ?? "viewer");
  };

  const saveOrg = async () => {
    if (!editing) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("master-admin-manage", {
      body: { action: "set_user_org", user_id: editing.user_id, org_id: orgId === NONE ? null : orgId, role },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not update user");
      return;
    }
    toast.success("User updated");
    setEditing(null);
    load();
  };

  const toggleActive = async (u: PlatformUser) => {
    const { data, error } = await supabase.functions.invoke("master-admin-manage", {
      body: { action: "set_user_active", user_id: u.user_id, active: !u.is_active },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not update user");
      return;
    }
    toast.success(u.is_active ? "User deactivated" : "User reactivated");
    load();
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.org_name || "").toLowerCase().includes(q))
    : users;

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">Every account on the platform</p>
        </div>
        <Input
          placeholder="Search name, email or organisation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:w-[280px]"
        />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">{filtered.length} accounts</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px]" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>{u.org_name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                      <TableCell>{u.role ? <Badge variant="secondary">{u.role}</Badge> : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "destructive"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd MMM yyyy HH:mm") : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                            <Settings2 className="mr-1 h-3.5 w-3.5" /> Organisation
                          </Button>
                          <Button
                            size="sm"
                            variant={u.is_active ? "destructive" : "secondary"}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No users found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign organisation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{editing?.email}</p>
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole} disabled={orgId === NONE}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveOrg} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MasterAdminLayout>
  );
}
