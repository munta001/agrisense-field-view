import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, KeyRound, List, LogIn, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";
import { format, subMonths, endOfToday } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Member = {
  id: string; user_id: string; role: string; is_active: boolean; created_at: string;
  full_name: string | null; email: string | null; last_sign_in_at: string | null;
};

type LogFilter = "all" | "alerts" | "signins";

const LOG_FILTERS: { value: LogFilter; label: string; icon: typeof List }[] = [
  { value: "all", label: "All activity", icon: List },
  { value: "alerts", label: "Alerts", icon: Bell },
  { value: "signins", label: "Sign-ins", icon: LogIn },
];

export default function AdminPage() {
  const { currentOrg, currentRole } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<Tables<"activity_logs">[]>([]);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");

  const logCounts = useMemo(() => ({
    all: logs.length,
    alerts: logs.filter(l => l.action === "alert_created").length,
    signins: logs.filter(l => l.action === "user_signed_in").length,
  }), [logs]);

  const filteredLogs = useMemo(
    () => logs.filter(log =>
      logFilter === "all" ? true
        : logFilter === "alerts" ? log.action === "alert_created"
        : log.action === "user_signed_in"),
    [logs, logFilter],
  );

  useEffect(() => {
    if (!currentOrg) return;
    (supabase as any).rpc("org_member_details", { p_org_id: currentOrg.id })
      .then(({ data }: any) => setMembers(data || []));
    // Activity logs cover the last month up to today.
    const from = subMonths(new Date(), 1);
    supabase.from("activity_logs").select("*").eq("org_id", currentOrg.id)
      .gte("created_at", from.toISOString()).lte("created_at", endOfToday().toISOString())
      .order("created_at", { ascending: false }).limit(500)
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setResetTarget(m)}>
                          <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="glass-card">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="font-display text-lg">Activity Logs</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Showing activity from {format(subMonths(new Date(), 1), "dd MMM yyyy")} to today
                </p>
              </div>
              <div className="flex flex-wrap gap-1 self-start rounded-xl border bg-muted/40 p-1 sm:self-auto">
                {LOG_FILTERS.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={logFilter === value ? "secondary" : "ghost"}
                    className={logFilter === value ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}
                    onClick={() => setLogFilter(value)}
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {label}
                    <span className="ml-1.5 text-xs tabular-nums opacity-70">{logCounts[value]}</span>
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {logFilter === "alerts"
                    ? "No alerts in the last month"
                    : logFilter === "signins"
                      ? "No sign-ins in the last month"
                      : "No activity in the last month"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => {
                      const details = (log.details || {}) as Record<string, any>;
                      const member = log.user_id ? members.find(m => m.user_id === log.user_id) : null;
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.action === "alert_created" ? (
                              <Badge variant={details.severity === "critical" ? "destructive" : "secondary"}>
                                New alert{details.severity ? ` · ${details.severity}` : ""}
                              </Badge>
                            ) : log.action === "user_signed_in" ? (
                              <Badge variant="outline">Sign in</Badge>
                            ) : (
                              <Badge variant="outline">{log.action}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {log.action === "alert_created"
                              ? <span><span className="font-medium text-foreground">{details.title || "Alert"}</span>{details.message ? ` — ${details.message}` : ""}</span>
                              : log.action === "user_signed_in"
                                ? <span>{member?.full_name || member?.email || "A member"} signed in{details.role ? ` (${details.role})` : ""}</span>
                                : JSON.stringify(log.details)}
                          </TableCell>
                          <TableCell>{format(new Date(log.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ResetPasswordDialog target={resetTarget} orgId={currentOrg?.id} onClose={() => setResetTarget(null)} />
    </div>
  );
}
