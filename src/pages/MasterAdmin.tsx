import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, Users, Radio, HardDrive } from "lucide-react";
import { format } from "date-fns";

type OrgUser = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
};

type OrgOverview = {
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
  readings_bytes?: number;
  reading_count?: number;
  users: OrgUser[];
};

export const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const roleVariant = (role: string) =>
  role === "admin" ? "default" : role === "operator" ? "secondary" : "outline";

export default function MasterAdminPage() {
  const { isMasterAdmin } = useAuth();
  const [orgs, setOrgs] = useState<OrgOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isMasterAdmin) return;
    setLoading(true);
    (supabase as any).rpc("master_admin_overview").then(({ data }: any) => {
      setOrgs((data?.organizations as OrgOverview[]) || []);
      setLoading(false);
    });
  }, [isMasterAdmin]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? orgs.filter(
        o =>
          o.name.toLowerCase().includes(q) ||
          o.users.some(u => (u.email || "").toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q)),
      )
    : orgs;

  const totals = orgs.reduce(
    (acc, o) => ({
      users: acc.users + o.users.length,
      sensors: acc.sensors + o.sensor_count,
      storage: acc.storage + Number(o.storage_bytes || 0),
    }),
    { users: 0, sensors: 0, storage: 0 },
  );

  const stats = [
    { title: "Organisations", value: orgs.length, icon: Building2, color: "text-primary" },
    { title: "Users", value: totals.users, icon: Users, color: "text-success" },
    { title: "Devices", value: totals.sensors, icon: Radio, color: "text-warning" },
    { title: "Storage used", value: formatBytes(totals.storage), icon: HardDrive, color: "text-destructive" },
  ];

  return (
    <MasterAdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Platform overview</h1>
          <p className="text-muted-foreground">All organisations, users, devices and storage</p>
        </div>
        <Input
          placeholder="Search organisation or user…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:w-[280px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.title} className="glass-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="font-display text-2xl font-bold">{loading ? "—" : stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[260px]" />)}
        </div>
      ) : !filtered.length ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">No organisations found</CardContent>
        </Card>
      ) : (
        filtered.map(org => (
          <Card key={org.id} className="glass-card">
            <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-display text-lg">{org.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(org.created_at), "dd MMM yyyy")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{org.users.length} users</Badge>
                <Badge variant="secondary">{org.sensor_count} devices ({org.active_sensor_count} active)</Badge>
                <Badge variant="secondary">{org.zone_count} zones</Badge>
                <Badge variant="secondary">{org.reading_count} readings</Badge>
                <Badge variant="outline">{formatBytes(Number(org.storage_bytes || 0))} · {org.storage_files} files</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last sign-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.users.length ? (
                      org.users.map(u => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                          <TableCell><Badge variant={roleVariant(u.role) as any}>{u.role}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.created_at ? format(new Date(u.created_at), "dd MMM yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd MMM yyyy HH:mm") : "Never"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No users assigned
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </MasterAdminLayout>
  );
}
