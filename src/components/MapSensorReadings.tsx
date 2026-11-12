import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowUpRight, Battery, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SOIL_METRICS } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

export function MapSensorReadings({ sensor, orgId, zoneName, onClose }: {
  sensor: Tables<"sensors"> | null;
  orgId: string;
  zoneName: string;
  onClose: () => void;
}) {
  const { data: latest, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["map-sensor-reading", orgId, sensor?.id],
    enabled: Boolean(sensor),
    refetchInterval: sensor ? 15_000 : false,
    queryFn: async () => {
      if (!sensor || sensor.org_id !== orgId) return null;
      const { data, error } = await supabase.from("sensor_readings").select("*")
        .eq("sensor_id", sensor.id)
        .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={Boolean(sensor)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="min-w-0 pr-6 text-left">
          <DialogTitle className="break-words leading-snug">{sensor?.name}</DialogTitle>
          <DialogDescription className="break-words">{zoneName} · {sensor?.device_id || "LoRaWAN device"}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className={sensor?.status === "online" ? "text-success" : sensor?.status === "offline" ? "text-destructive" : "text-warning"}>
            {sensor?.status}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "motion-safe:animate-spin" : ""}`} />Refresh
          </Button>
        </div>
        {isError ? (
          <p role="alert" className="py-6 text-sm text-destructive">Readings could not be loaded. Please try refreshing.</p>
        ) : isPending ? (
          <div className="grid grid-cols-2 gap-3">{SOIL_METRICS.map((metric) => <Skeleton key={metric.key} className="h-24" />)}</div>
        ) : !latest ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No readings received from this device yet.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Latest reading · {format(new Date(latest.recorded_at), "dd MMM yyyy, HH:mm:ss")}</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SOIL_METRICS.map((metric) => (
                <div key={metric.key} className="min-w-0 rounded-md border bg-muted/30 p-3">
                  <dt className="break-words text-xs text-muted-foreground">{metric.label}</dt>
                  <dd className="mt-2 flex flex-wrap items-baseline gap-1 break-all font-display text-xl font-semibold">
                    {latest[metric.key] ?? "—"}<span className="text-xs font-normal text-muted-foreground">{metric.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {latest.battery_v != null && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Battery className="h-4 w-4" />Battery {latest.battery_v} V</p>}
          </>
        )}
        {sensor && <Button asChild variant="outline" className="justify-self-end"><Link to={`/sensors/${sensor.id}`}>Sensor details<ArrowUpRight className="h-4 w-4" /></Link></Button>}
      </DialogContent>
    </Dialog>
  );
}