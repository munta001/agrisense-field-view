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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Membership = { org_id: string; org_name: string | null; role: string };

type MasterAdminRow = {
  user_id: string;
  granted_at: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  provider: string;
  is_active: boolean;
  is_self: boolean;
  memberships: Membership[];
};

const dt = (v: string | null) => (v ? format(new Date(v), "dd MMM yyyy HH:mm") : "—");

export default function MasterAdminAdminsPage() {
  const { isMasterAdmin } = useAuth();
  const [admins, setAdmins] = useState<MasterAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<MasterAdminRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("master-admin-manage", { body });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Something went wrong");
      return null;
    }
    return data as any;
  };

  const load = async () => {
    setLoading(true);
    const data = await call({ action: "list_master_admins" });
    if (data) setAdmins(data.admins || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isMasterAdmin) load();
  }, [isMasterAdmin]);

  const create = async () => {
    if (!email.trim()) return toast.error("Email address is required");
    setBusy(true);
    const res = await call({
      action: "create_master_admin",
      email: email.trim(),
      full_name: fullName.trim(),
      password: password.trim(),
    });
    setBusy(false);
    if (!res) return;
    toast.success(res.emailed ? "Master admin created — email sent" : "Master admin created");
    setCreateOpen(false);
    setEmail(""); setFullName(""); setPassword("");
    load();
  };

  const remove = async (a: MasterAdminRow) => {
    if (!confirm(`Remove master admin access for ${a.email}?`)) return;
    const ok = await call({ action: "remove_master_admin", user_id: a.user_id });
    if (!ok) return;
    toast.success("Master admin access removed");
    load();
  };

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Master admins</h1>
          <p className="text-muted-foreground">People with full access to every organisation on the platform</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New master admin
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> {admins.length} master admin{admins.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map(a => (
                    <TableRow key={a.user_id}>
                      <TableCell className="font-medium">
                        {a.full_name || "—"}{a.is_self && <Badge variant="secondary" className="ml-2 font-normal">You</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={a.is_active ? "default" : "destructive"}>{a.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.last_sign_in_at ? dt(a.last_sign_in_at) : "Never"}</TableCell>
                      <TableCell className="text-muted-foreground">{dt(a.granted_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setViewing(a)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> View
                          </Button>
                          <Button size="sm" variant="ghost" disabled={a.is_self} onClick={() => remove(a)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!admins.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No master admins yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Master admin details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              {[
                ["Name", viewing.full_name || "—"],
                ["Email", viewing.email || "—"],
                ["Email confirmed", viewing.email_confirmed_at ? dt(viewing.email_confirmed_at) : "Not confirmed"],
                ["Sign-in method", viewing.provider],
                ["Account status", viewing.is_active ? "Active" : "Inactive"],
                ["Account created", dt(viewing.created_at)],
                ["Master admin since", dt(viewing.granted_at)],
                ["Last sign-in", viewing.last_sign_in_at ? dt(viewing.last_sign_in_at) : "Never"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="min-w-0 break-words font-medium sm:text-right">{v}</span>
                </div>
              ))}
              <div>
                <p className="mb-1.5 text-muted-foreground">Organisation memberships</p>
                {viewing.memberships.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {viewing.memberships.map(m => (
                      <Badge key={m.org_id} variant="secondary" className="font-normal">{m.org_name} · {m.role}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">None — platform-wide access only</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewing(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New master admin</DialogTitle>
            <DialogDescription>
              An email is sent to this address so they can set their password and sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ma-email">Email address *</Label>
              <Input id="ma-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-name">Full name</Label>
              <Input id="ma-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-pass">Temporary password (optional)</Label>
              <Input id="ma-pass" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave empty to let them choose one" />
              <p className="text-xs text-muted-foreground">
                Leave empty and they receive an invitation email to set their own password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create master admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MasterAdminLayout>
  );
}
