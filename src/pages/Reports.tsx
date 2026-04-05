import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrgContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download } from "lucide-react";

// Static demo reports for presentation
const demoReports = [
  { id: "1", name: "Daily Sensor Summary", date: "2026-04-05", type: "Daily", status: "Generated" },
  { id: "2", name: "Weekly Temperature Report", date: "2026-03-30", type: "Weekly", status: "Generated" },
  { id: "3", name: "Monthly Soil Analysis", date: "2026-03-01", type: "Monthly", status: "Generated" },
  { id: "4", name: "Alert Frequency Report", date: "2026-04-04", type: "Custom", status: "Generated" },
  { id: "5", name: "Sensor Uptime Report", date: "2026-04-03", type: "Weekly", status: "Generated" },
];

export default function ReportsPage() {
  const { currentOrg } = useOrg();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and download reports for {currentOrg?.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["Daily Summary", "Weekly Analysis", "Monthly Overview"].map(type => (
          <Card key={type} className="glass-card cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg p-2.5 bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{type}</p>
                <p className="text-sm text-muted-foreground">Generate report</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">Recent Reports</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoReports.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell><span className="text-success font-medium">{r.status}</span></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
