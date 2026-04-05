import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrg } from "@/contexts/OrgContext";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// Static demo data for presentation
const tempData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  avgTemp: 20 + Math.sin(i / 5) * 10 + Math.random() * 3,
  maxTemp: 28 + Math.sin(i / 5) * 8 + Math.random() * 2,
  minTemp: 14 + Math.sin(i / 5) * 6 + Math.random() * 2,
}));

const moistureData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  zoneA: 55 + Math.sin(i / 4) * 15 + Math.random() * 5,
  zoneB: 40 + Math.cos(i / 3) * 12 + Math.random() * 5,
  zoneC: 60 + Math.sin(i / 6) * 10 + Math.random() * 3,
}));

const sensorTypeDistribution = [
  { name: "Temperature", value: 8, color: "hsl(0, 72%, 51%)" },
  { name: "Humidity", value: 6, color: "hsl(200, 70%, 50%)" },
  { name: "Soil Moisture", value: 5, color: "hsl(152, 55%, 28%)" },
  { name: "Light", value: 4, color: "hsl(38, 90%, 55%)" },
  { name: "pH", value: 3, color: "hsl(270, 50%, 55%)" },
];

const weeklyAlerts = [
  { day: "Mon", critical: 2, warning: 5, info: 8 },
  { day: "Tue", critical: 1, warning: 3, info: 6 },
  { day: "Wed", critical: 0, warning: 4, info: 7 },
  { day: "Thu", critical: 3, warning: 2, info: 5 },
  { day: "Fri", critical: 1, warning: 6, info: 9 },
  { day: "Sat", critical: 0, warning: 1, info: 3 },
  { day: "Sun", critical: 0, warning: 2, info: 4 },
];

export default function AnalyticsPage() {
  const { currentOrg } = useOrg();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Detailed sensor data analysis for {currentOrg?.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Temperature Trends (30 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="maxTemp" stroke="hsl(0, 72%, 51%)" name="Max °C" dot={false} />
                <Line type="monotone" dataKey="avgTemp" stroke="hsl(38, 90%, 55%)" name="Avg °C" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="minTemp" stroke="hsl(200, 70%, 50%)" name="Min °C" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Soil Moisture by Zone</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={moistureData}>
                <defs>
                  <linearGradient id="zA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 55%, 28%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 55%, 28%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="zB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="zC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38, 90%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(38, 90%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="zoneA" stroke="hsl(152, 55%, 28%)" fill="url(#zA)" name="Zone A" />
                <Area type="monotone" dataKey="zoneB" stroke="hsl(200, 70%, 50%)" fill="url(#zB)" name="Zone B" />
                <Area type="monotone" dataKey="zoneC" stroke="hsl(38, 90%, 55%)" fill="url(#zC)" name="Zone C" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Sensor Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={sensorTypeDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {sensorTypeDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Weekly Alerts</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyAlerts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="critical" fill="hsl(0, 72%, 51%)" name="Critical" radius={[2, 2, 0, 0]} />
                <Bar dataKey="warning" fill="hsl(38, 90%, 55%)" name="Warning" radius={[2, 2, 0, 0]} />
                <Bar dataKey="info" fill="hsl(200, 70%, 50%)" name="Info" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
