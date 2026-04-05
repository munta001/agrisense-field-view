import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export default function DataEntryPage() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const [sensors, setSensors] = useState<Tables<"sensors">[]>([]);
  const [entries, setEntries] = useState<Tables<"data_entries">[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ sensor_id: "", value: "", notes: "" });
  const { toast } = useToast();
  const canEdit = currentRole?.role === "admin" || currentRole?.role === "operator";

  const fetchEntries = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.from("data_entries").select("*").eq("org_id", currentOrg.id).order("recorded_at", { ascending: false }).limit(50);
    setEntries(data || []);
  };

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("sensors").select("*").eq("org_id", currentOrg.id).then(({ data }) => setSensors(data || []));
    fetchEntries();
  }, [currentOrg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !user) return;
    setLoading(true);
    const { error } = await supabase.from("data_entries").insert({
      org_id: currentOrg.id, user_id: user.id,
      sensor_id: form.sensor_id || null, value: parseFloat(form.value), notes: form.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Data entry recorded" }); setForm({ sensor_id: "", value: "", notes: "" }); fetchEntries(); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Data Entry</h1>

      {canEdit && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display text-lg">Add Manual Reading</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Select value={form.sensor_id} onValueChange={v => setForm({ ...form, sensor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sensor (optional)" /></SelectTrigger>
                <SelectContent>{sensors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" step="any" placeholder="Value" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required />
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="sm:col-span-1" />
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-2 h-4 w-4" />Record</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="font-display text-lg">Recent Entries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{format(new Date(entry.recorded_at), "dd MMM yyyy HH:mm")}</TableCell>
                  <TableCell className="font-mono">{entry.value}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.notes || "—"}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No data entries yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
