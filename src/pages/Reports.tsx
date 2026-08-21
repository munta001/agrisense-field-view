import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon, FileText, Download, Loader2 } from "lucide-react";
import { format, startOfDay, subDays, subMonths } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";

type Sensor = Tables<"sensors">;
type Reading = Tables<"sensor_readings">;

const METRICS = [
  { key: "temperature_c", label: "Temp (°C)" },
  { key: "moisture_pct", label: "Moisture (%)" },
  { key: "conductivity", label: "EC (µS/cm)" },
  { key: "ph", label: "pH" },
  { key: "nitrogen", label: "N (mg/kg)" },
  { key: "phosphorus", label: "P (mg/kg)" },
  { key: "potassium", label: "K (mg/kg)" },
  { key: "salinity", label: "Salinity" },
] as const;

const PERIODS = [
  { key: "daily", label: "Daily (last 24 hours)" },
  { key: "weekly", label: "Weekly (last 7 days)" },
  { key: "monthly", label: "Monthly (last 30 days)" },
  { key: "custom", label: "Custom date range" },
];

type Generated = {
  id: string;
  name: string;
  type: string;
  date: string;
  rows: number;
  blobUrl: string;
  fileName: string;
};

type PreviewData = {
  report: Generated;
  readings: Reading[];
  summary: { label: string; last: string; min: string; max: string; avg: string }[];
};

export default function ReportsPage() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorId, setSensorId] = useState("");
  const [period, setPeriod] = useState("daily");
  const [from, setFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [to, setTo] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<Generated[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    supabase.from("sensors").select("*").eq("org_id", currentOrg.id).order("device_id").then(({ data }) => {
      const list = data || [];
      setSensors(list);
      setSensorId(prev => prev || list[0]?.id || "");
      setLoading(false);
    });
  }, [currentOrg]);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "daily") return { start: subDays(now, 1), end: now, label: "Daily" };
    if (period === "weekly") return { start: subDays(now, 7), end: now, label: "Weekly" };
    if (period === "monthly") return { start: subMonths(now, 1), end: now, label: "Monthly" };
    return { start: from ? startOfDay(from) : subDays(now, 7), end: to ?? now, label: "Custom" };
  }, [period, from, to]);

  const selected = sensors.find(s => s.id === sensorId);

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .eq("sensor_id", selected.id)
        .gte("recorded_at", range.start.toISOString())
        .lte("recorded_at", range.end.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      const readings = (data || []) as Reading[];
      if (!readings.length) {
        toast({ title: "No data", description: "No readings for this device in the selected period", variant: "destructive" });
        return;
      }

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(18);
      doc.text(`${range.label} Sensor Report`, 40, 45);
      doc.setFontSize(10);
      doc.text(
        [
          `Organisation: ${currentOrg?.name ?? "-"}`,
          `Device: ${selected.name}${selected.device_id != null ? ` (#${selected.device_id})` : ""}`,
          `Period: ${format(range.start, "dd MMM yyyy HH:mm")} — ${format(range.end, "dd MMM yyyy HH:mm")}`,
          `Readings: ${readings.length} · Generated ${format(new Date(), "dd MMM yyyy HH:mm")}`,
        ],
        40,
        65
      );

      const num = (k: string) =>
        readings.map(r => r[k as keyof Reading] as number | null).filter((v): v is number => v != null);

      const summary = METRICS.map(m => {
        const v = num(m.key);
        if (!v.length) return { label: m.label, last: "—", min: "—", max: "—", avg: "—" };
        return {
          label: m.label,
          last: v[v.length - 1].toFixed(2),
          min: Math.min(...v).toFixed(2),
          max: Math.max(...v).toFixed(2),
          avg: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2),
        };
      });

      autoTable(doc, {
        startY: 130,
        head: [["Metric", "Last", "Min", "Max", "Average"]],
        body: summary.map(s => [s.label, s.last, s.min, s.max, s.avg]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 84, 61] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 24,
        head: [["Recorded at", ...METRICS.map(m => m.label), "Battery (V)"]],
        body: readings.map(r => [
          format(new Date(r.recorded_at), "dd MMM HH:mm"),
          ...METRICS.map(m => {
            const v = r[m.key as keyof Reading] as number | null;
            return v == null ? "—" : String(v);
          }),
          r.battery_v == null ? "—" : String(r.battery_v),
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [34, 84, 61] },
      });

      const fileName = `${range.label.toLowerCase()}-report-${selected.name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`;
      const blobUrl = URL.createObjectURL(doc.output("blob"));

      const report: Generated = {
        id: crypto.randomUUID(),
        name: `${range.label} report — ${selected.name}`,
        type: range.label,
        date: format(new Date(), "yyyy-MM-dd HH:mm"),
        rows: readings.length,
        blobUrl,
        fileName,
      };
      setReports(prev => [report, ...prev]);
      setPreview({ report, readings, summary });
      toast({ title: "Report generated", description: `${readings.length} readings exported to PDF` });
    } catch (e: any) {
      toast({ title: "Failed to generate report", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const quick = (p: string) => { setPeriod(p); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate PDF sensor reports for {currentOrg?.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { key: "daily", label: "Daily Summary" },
          { key: "weekly", label: "Weekly Analysis" },
          { key: "monthly", label: "Monthly Overview" },
        ].map(t => (
          <Card
            key={t.key}
            onClick={() => quick(t.key)}
            className={cn(
              "glass-card cursor-pointer transition-colors hover:border-primary/50",
              period === t.key && "border-primary"
            )}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileText className="h-5 w-5" /></div>
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-sm text-muted-foreground">Select period</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">Generate report</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : !sensors.length ? (
            <p className="py-6 text-center text-muted-foreground">No devices registered yet</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Select value={sensorId} onValueChange={setSensorId}>
                  <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Select device" /></SelectTrigger>
                  <SelectContent>
                    {sensors.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.device_id != null ? ` (#${s.device_id})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                {period === "custom" && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal sm:w-[190px]", !from && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {from ? format(from, "PPP") : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={from} onSelect={setFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal sm:w-[190px]", !to && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {to ? format(to, "PPP") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={to} onSelect={setTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </>
                )}

                <Button onClick={generate} disabled={generating || !sensorId} className="w-full sm:w-auto">
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Generate Report
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Range: {format(range.start, "dd MMM yyyy HH:mm")} — {format(range.end, "dd MMM yyyy HH:mm")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card className="glass-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-lg">Report preview</CardTitle>
              <p className="text-sm text-muted-foreground">{preview.report.name}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={preview.report.blobUrl} download={preview.report.fileName}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-hidden rounded-md border bg-white text-slate-900 shadow-sm">
              <div className="max-h-[600px] overflow-auto p-4 sm:p-6">
                <div className="mb-6 border-b pb-4">
                  <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{preview.report.type} Sensor Report</h2>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p><span className="font-medium">Organisation:</span> {currentOrg?.name ?? "-"}</p>
                    <p><span className="font-medium">Device:</span> {selected?.name}{selected?.device_id != null ? ` (#${selected.device_id})` : ""}</p>
                    <p><span className="font-medium">Period:</span> {format(preview.readings[0]?.recorded_at ? new Date(preview.readings[0].recorded_at) : range.start, "dd MMM yyyy HH:mm")} — {format(preview.readings[preview.readings.length - 1]?.recorded_at ? new Date(preview.readings[preview.readings.length - 1].recorded_at) : range.end, "dd MMM yyyy HH:mm")}</p>
                    <p><span className="font-medium">Readings:</span> {preview.readings.length} · Generated {format(new Date(), "dd MMM yyyy HH:mm")}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-emerald-900">
                        <tr>
                          {["Metric", "Last", "Min", "Max", "Average"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-white">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {preview.summary.map((s, i) => (
                          <tr key={i} className={i % 2 === 1 ? "bg-slate-50" : ""}>
                            <td className="px-3 py-2 font-medium">{s.label}</td>
                            <td className="px-3 py-2">{s.last}</td>
                            <td className="px-3 py-2">{s.min}</td>
                            <td className="px-3 py-2">{s.max}</td>
                            <td className="px-3 py-2">{s.avg}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Readings</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                      <thead className="bg-emerald-900">
                        <tr>
                          <th className="sticky top-0 px-3 py-2 text-left font-medium text-white">Recorded at</th>
                          {METRICS.map(m => (
                            <th key={m.key} className="sticky top-0 px-3 py-2 text-left font-medium text-white">{m.label}</th>
                          ))}
                          <th className="sticky top-0 px-3 py-2 text-left font-medium text-white">Battery (V)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {preview.readings.map((r, i) => (
                          <tr key={r.id ?? i} className={i % 2 === 1 ? "bg-slate-50" : ""}>
                            <td className="whitespace-nowrap px-3 py-2">{format(new Date(r.recorded_at), "dd MMM HH:mm")}</td>
                            {METRICS.map(m => {
                              const v = r[m.key as keyof Reading] as number | null;
                              return <td key={m.key} className="whitespace-nowrap px-3 py-2">{v == null ? "—" : String(v)}</td>;
                            })}
                            <td className="px-3 py-2">{r.battery_v == null ? "—" : String(r.battery_v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">Generated reports</CardTitle></CardHeader>
        <CardContent>
          {!reports.length ? (
            <p className="py-8 text-center text-muted-foreground">No reports generated in this session yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Readings</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.rows}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={r.blobUrl} download={r.fileName}><Download className="h-4 w-4" /></a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
