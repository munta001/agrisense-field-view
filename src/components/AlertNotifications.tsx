import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

export function AlertNotifications({ collapsed, isMobile, onNavigate }: {
  collapsed: boolean; isMobile: boolean; onNavigate: () => void;
}) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = currentOrg?.id;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alert-notifications", user?.id, orgId],
    enabled: Boolean(user && orgId),
    refetchInterval: 15000,
    queryFn: async () => {
      if (!orgId) return { alerts: [], unread: 0 };
      const [recent, unread] = await Promise.all([
        supabase.from("alerts").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_read", false),
      ]);
      if (recent.error) throw recent.error;
      if (unread.error) throw unread.error;
      return { alerts: recent.data ?? [], unread: unread.count ?? 0 };
    },
  });
  const viewAlerts = () => {
    setOpen(false);
    onNavigate();
    navigate("/alerts");
  };
  if (!currentOrg) return null;

  return (
    <Popover open={open} onOpenChange={value => { setOpen(value); if (value) void refetch(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size={collapsed ? "icon" : "default"}
          aria-label={`Alert notifications, ${data?.unread ?? 0} unread`}
          title="Alert notifications"
          className={`relative text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "" : "w-full justify-start px-2"}`}>
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
            <Bell className="h-4 w-4 text-sidebar-primary" />
            {(data?.unread ?? 0) > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                {data && data.unread > 99 ? "99+" : data?.unread}
              </span>
            )}
          </span>
          {!collapsed && <span className="text-sm">Notifications</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent side={isMobile ? "bottom" : "right"} align="start" sideOffset={12}
        className="w-80 overflow-hidden p-0" aria-label="Recent alert notifications">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="View all alerts" aria-label="View all alerts" onClick={viewAlerts}>
            <ArrowUpRight />
          </Button>
        </div>
        <div className="max-h-[min(26rem,55dvh)] space-y-1 overflow-y-auto overscroll-contain p-2">
          {isLoading ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />) :
            isError ? <div className="p-4 text-sm text-muted-foreground">Couldn't load alerts. <Button variant="link" size="sm" onClick={() => void refetch()}>Retry</Button></div> :
              !data?.alerts.length ? <p className="p-5 text-center text-sm text-muted-foreground">No alerts</p> :
                data.alerts.map(alert => (
                  <Button key={alert.id} variant="ghost" className={`h-auto w-full flex-col items-start gap-1 whitespace-normal rounded-md p-3 text-left sm:h-auto ${alert.is_read ? "bg-muted/50" : "bg-primary/5"} hover:bg-primary/10`}
                    onClick={async () => {
                      if (!alert.is_read) {
                        await supabase.from("alerts").update({ is_read: true }).eq("org_id", orgId).eq("id", alert.id);
                        void queryClient.invalidateQueries({ queryKey: ["alert-notifications"] });
                      }
                      viewAlerts();
                    }}>
                    <span className="flex w-full items-start gap-2">
                      <span className="min-w-0 flex-1 break-words text-xs font-bold leading-5">{alert.title}</span>
                      {!alert.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </span>
                    <span className="break-words text-xs font-normal leading-4 text-muted-foreground">{alert.message}</span>
                    <time className="text-[10px] font-normal text-muted-foreground" dateTime={alert.created_at}>{format(new Date(alert.created_at), "dd/MM/yyyy h:mm a")}</time>
                  </Button>
                ))}
        </div>
        <div className="border-t p-2"><Button variant="ghost" className="w-full" onClick={viewAlerts}>View all unread alerts <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div>
      </PopoverContent>
    </Popover>
  );
}