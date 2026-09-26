import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Member = {
  id: string; user_id: string; role: string; is_active: boolean; created_at: string;
  full_name: string | null; email: string | null; last_sign_in_at: string | null;
};

export default function AdminPage() {
  const { currentOrg, currentRole } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<Tables<"activity_logs">[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    (supabase as any).rpc("org_member_details", { p_org_id: currentOrg.id })
      .then(({ data }: any) => setMembers(data || []));
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
      <div>
        <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage {currentOrg?.name}</p>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" />Members</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><Settings className="h-4 w-4" />Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card className="glass-card">
            <CardHeader><CardTitle className="font-display text-lg">Organisation Members</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last sign in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name || "Unknown"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.role === "admin" ? "default" : m.role === "operator" ? "secondary" : "outline"}>{m.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? "secondary" : "outline"}>{m.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>{m.last_sign_in_at ? format(new Date(m.last_sign_in_at), "dd MMM yyyy HH:mm") : "Never"}</TableCell>
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
