import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Droplets, Thermometer, Sun, FlaskConical } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const iconMap: Record<string, any> = {
  thermometer: Thermometer, droplets: Droplets, "cloud-rain": Droplets,
  sun: Sun, "flask-conical": FlaskConical,
};

// Static demo data for presentation
const demoChartData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  temperature: 22 + Math.sin(i / 4) * 8 + Math.random() * 2,
  humidity: 65 + Math.cos(i / 3) * 15 + Math.random() * 3,
  soilMoisture: 45 + Math.sin(i / 5) * 10 + Math.random() * 2,
}));

export default function DashboardPage() {
  const { currentOrg } = useOrg();
  const [sensorCount, setSensorCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("sensors").select("id, status", { count: "exact" }).eq("org_id", currentOrg.id)
      .then(({ data, count }) => {
        setSensorCount(count || 0);
        setOnlineCount(data?.filter(s => s.status === "online").length || 0);
      });
    supabase.from("alerts").select("id", { count: "exact" }).eq("org_id", currentOrg.id).eq("is_read", false)
      .then(({ count }) => setAlertCount(count || 0));
  }, [currentOrg]);

  const stats = [
    { title: "Total Sensors", value: sensorCount, icon: Activity, color: "text-primary" },
    { title: "Online", value: onlineCount, icon: Activity, color: "text-success" },
    { title: "Offline", value: sensorCount - onlineCount, icon: Activity, color: "text-destructive" },
    { title: "Active Alerts", value: alertCount, icon: AlertTriangle, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of {currentOrg?.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.title} className="glass-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg p-2.5 bg-muted ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">Temperature & Humidity (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={demoChartData}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="temperature" stroke="hsl(0, 72%, 51%)" fill="url(#tempGrad)" name="Temp (°C)" />
                <Area type="monotone" dataKey="humidity" stroke="hsl(200, 70%, 50%)" fill="url(#humGrad)" name="Humidity (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">Soil Moisture (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={demoChartData}>
                <defs>
                  <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="soilMoisture" stroke="hsl(var(--primary))" fill="url(#soilGrad)" name="Soil Moisture (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
