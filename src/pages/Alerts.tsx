import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, AlertOctagon, Check } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";

export default function AlertsPage() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const [alerts, setAlerts] = useState<Tables<"alerts">[]>([]);


  const fetchAlerts = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.from("alerts").select("*").eq("org_id", currentOrg.id).order("created_at", { ascending: false }).limit(20);
    setAlerts(data || []);
  };

  useEffect(() => { fetchAlerts(); }, [currentOrg]);

  const markRead = async (id: string) => {
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["alert-notifications"] });
    fetchAlerts();
  };


  const severityConfig = {
    critical: { icon: AlertOctagon, color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" as const },
    warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", badge: "secondary" as const },
    info: { icon: Info, color: "text-info", bg: "bg-info/10", badge: "default" as const },
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Alerts & Notifications</h1>
          <p className="text-muted-foreground">20 most recent · {unreadCount} unread</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map(alert => {
          const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
          const Icon = config.icon;
          return (
            <Card key={alert.id} className={`glass-card transition-all ${!alert.is_read ? "border-l-4" : "opacity-60"}`}
              style={!alert.is_read ? { borderLeftColor: alert.severity === "critical" ? "hsl(0, 72%, 51%)" : alert.severity === "warning" ? "hsl(38, 90%, 55%)" : "hsl(200, 70%, 50%)" } : {}}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className={`shrink-0 rounded-lg p-2 ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium">{alert.title}</span>
                    <Badge variant={config.badge}>{alert.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(alert.created_at), "dd MMM yyyy HH:mm")}</p>
                </div>
                {!alert.is_read && (
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label="Mark alert as read" onClick={() => markRead(alert.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {alerts.length === 0 && (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No alerts</p>
              <p className="text-sm">All systems operating normally</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
