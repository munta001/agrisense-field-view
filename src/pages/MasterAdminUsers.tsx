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
import { KeyRound, Loader2, Phone, Plus, Settings2, Trash2 } from "lucide-react";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";
import { toast } from "sonner";
import { format } from "date-fns";

type Membership = { org_id: string; org_name: string | null; role: string; is_active: boolean };

type PlatformUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  memberships: Membership[];
  is_active: boolean;
};

type Org = { id: string; name: string };

export default function MasterAdminUsersPage() {
  const { isMasterAdmin } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [newOrgId, setNewOrgId] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [phoneTarget, setPhoneTarget] = useState<PlatformUser | null>(null);
  const [phoneInput, setPhoneInput] = useState("");

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("master-admin-manage", { body });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Something went wrong");
      return null;
    }
    return data as any;
  };

  const load = async (keepEditingId?: string) => {
    setLoading(true);
    const data = await call({ action: "list_users" });
    if (data) {
      const list: PlatformUser[] = data.users || [];
      setUsers(list);
      setOrgs(data.organizations || []);
      if (keepEditingId) setEditing(list.find(u => u.user_id === keepEditingId) ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isMasterAdmin) load();
  }, [isMasterAdmin]);

  const addMembership = async () => {
    if (!editing) return;
    if (!newOrgId) return toast.error("Choose an organisation");
    setBusy(true);
    const ok = await call({ action: "set_membership", user_id: editing.user_id, org_id: newOrgId, role: newRole });
    setBusy(false);
    if (!ok) return;
    toast.success("Organisation assigned");
    setNewOrgId("");
    setNewRole("viewer");
    load(editing.user_id);
  };

  const changeRole = async (m: Membership, role: string) => {
    if (!editing) return;
    setBusy(true);
    const ok = await call({ action: "set_membership", user_id: editing.user_id, org_id: m.org_id, role });
    setBusy(false);
    if (!ok) return;
    toast.success("Role updated");
    load(editing.user_id);
  };

  const toggleMembershipActive = async (m: Membership) => {
    if (!editing) return;
    setBusy(true);
    const ok = await call({
      action: "set_membership_active",
      user_id: editing.user_id,
      org_id: m.org_id,
      active: !m.is_active,
    });
    setBusy(false);
    if (!ok) return;
    toast.success(m.is_active ? `Deactivated in ${m.org_name}` : `Reactivated in ${m.org_name}`);
    load(editing.user_id);
  };

  const removeMembership = async (m: Membership) => {
    if (!editing) return;
    setBusy(true);
    const ok = await call({ action: "remove_membership", user_id: editing.user_id, org_id: m.org_id });
    setBusy(false);
    if (!ok) return;
    toast.success("Removed from organisation");
    load(editing.user_id);
  };

  const openPhoneEditor = (u: PlatformUser) => {
    setPhoneTarget(u);
    setPhoneInput(u.phone_number || "");
  };

  const savePhone = async () => {
    if (!phoneTarget) return;
    setBusy(true);
    const ok = await call({ action: "update_user_phone", user_id: phoneTarget.user_id, phone_number: phoneInput.trim() });
    setBusy(false);
    if (!ok) return;
    toast.success("Phone number updated");
    setPhoneTarget(null);
    load();
  };

  const toggleActive = async (u: PlatformUser) => {
    const ok = await call({ action: "set_user_active", user_id: u.user_id, active: !u.is_active });
    if (!ok) return;
    toast.success(u.is_active ? "User deactivated" : "User reactivated");
    load();
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        u.memberships.some(m => (m.org_name || "").toLowerCase().includes(q)))
    : users;

  const availableOrgs = orgs.filter(o => !editing?.memberships.some(m => m.org_id === o.id));

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">Every account on the platform — a user can belong to several organisations</p>
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
                    <TableHead>Phone</TableHead>
                    <TableHead>Organisations &amp; roles</TableHead>
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
                      <TableCell className="text-muted-foreground">{u.phone_number || "—"}</TableCell>
                      <TableCell>
                        {u.memberships.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {u.memberships.map(m => (
                              <Badge
                                key={m.org_id}
                                variant={m.is_active ? "secondary" : "outline"}
                                className={m.is_active ? "font-normal" : "font-normal text-muted-foreground line-through"}
                              >
                                {m.org_name} · {m.role}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
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
                          <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                            <Settings2 className="mr-1 h-3.5 w-3.5" /> Organisations
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openPhoneEditor(u)}>
                            <Phone className="mr-1 h-3.5 w-3.5" /> Phone
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setResetTarget(u)}>
                            <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant={u.is_active ? "destructive" : "secondary"}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? "Deactivate everywhere" : "Activate"}
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
          <DialogHeader><DialogTitle>Organisations &amp; roles</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{editing?.email}</p>

            <div className="space-y-2">
              <Label>Current memberships</Label>
              {editing?.memberships.length ? (
                <div className="space-y-2">
                  {editing.memberships.map(m => (
                    <div key={m.org_id} className="flex items-center gap-2 rounded-md border p-2">
                      <span className="flex-1 truncate text-sm font-medium">{m.org_name}</span>
                      <Select value={m.role} onValueChange={v => changeRole(m, v)} disabled={busy}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant={m.is_active ? "destructive" : "secondary"}
                        disabled={busy}
                        onClick={() => toggleMembershipActive(m)}
                      >
                        {m.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="icon" variant="ghost" disabled={busy} onClick={() => removeMembership(m)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not assigned to any organisation yet.</p>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Add to an organisation</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={newOrgId} onValueChange={setNewOrgId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose organisation" /></SelectTrigger>
                  <SelectContent>
                    {availableOrgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    {!availableOrgs.length && <SelectItem value="none" disabled>No other organisations</SelectItem>}
                  </SelectContent>
                </Select>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="sm:w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addMembership} disabled={busy || !newOrgId}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!phoneTarget} onOpenChange={o => !o && setPhoneTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit phone number</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{phoneTarget?.email}</p>
            <Label htmlFor="ma-user-phone">Phone number</Label>
            <Input
              id="ma-user-phone"
              type="tel"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              maxLength={20}
              placeholder="+230 5xxx xxxx"
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneTarget(null)}>Cancel</Button>
            <Button onClick={savePhone} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </MasterAdminLayout>
  );
}
