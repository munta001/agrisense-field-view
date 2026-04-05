import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Settings, Users, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type UserRoleWithProfile = Tables<"user_roles"> & { profiles?: { full_name: string | null } };

export default function AdminPage() {
  const { currentOrg, currentRole } = useOrg();
  const [members, setMembers] = useState<UserRoleWithProfile[]>([]);
  const [sensorTypes, setSensorTypes] = useState<Tables<"sensor_types">[]>([]);
  const [logs, setLogs] = useState<Tables<"activity_logs">[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");
  const { toast } = useToast();

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("user_roles").select("*").eq("org_id", currentOrg.id)
      .then(async ({ data: roles }) => {
        if (!roles) { setMembers([]); return; }
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const merged = roles.map(r => ({
          ...r,
          profiles: profiles?.find(p => p.user_id === r.user_id) || null,
        }));
        setMembers(merged as any);
      });
    supabase.from("sensor_types").select("*").then(({ data }) => setSensorTypes(data || []));
    supabase.from("activity_logs").select("*").eq("org_id", currentOrg.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setLogs(data || []));
  }, [currentOrg]);

  if (currentRole?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-lg">Access denied. Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage {currentOrg?.name}</p>
        </div>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" />Members</TabsTrigger>
          <TabsTrigger value="sensors" className="gap-2"><Activity className="h-4 w-4" />Sensor Types</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><Settings className="h-4 w-4" />Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Organisation Members</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{m.profiles?.full_name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant={m.role === "admin" ? "default" : m.role === "operator" ? "secondary" : "outline"}>
                          {m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sensors">
          <Card className="glass-card">
            <CardHeader><CardTitle className="font-display text-lg">Available Sensor Types</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sensorTypes.map(st => (
                    <TableRow key={st.id}>
                      <TableCell className="font-medium">{st.name}</TableCell>
                      <TableCell>{st.unit}</TableCell>
                      <TableCell className="font-mono">{st.min_value} – {st.max_value}</TableCell>
                      <TableCell className="text-muted-foreground">{st.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="glass-card">
            <CardHeader><CardTitle className="font-display text-lg">Activity Logs</CardTitle></CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity logged yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell>{log.action}</TableCell>
                        <TableCell className="text-muted-foreground">{JSON.stringify(log.details)}</TableCell>
                        <TableCell>{format(new Date(log.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
