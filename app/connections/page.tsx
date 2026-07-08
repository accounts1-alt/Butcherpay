import { supabaseServer } from "@/lib/supabase/server";
import type { ConnectionRow } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createConnection, syncCsvConnection } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "muted"> = {
  healthy: "success",
  failing: "destructive",
  disabled: "muted",
};

export default async function ConnectionsPage() {
  const supabase = supabaseServer();
  const { data: connections, error } = await supabase
    .from("connections")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);

  const rows = (connections ?? []) as ConnectionRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          External systems this app reads POS totals from.
        </p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last synced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((conn) => (
                <TableRow key={conn.id} className="align-top">
                  <TableCell className="font-medium">{conn.name}</TableCell>
                  <TableCell className="uppercase text-xs text-muted-foreground">{conn.type}</TableCell>
                  <TableCell>{conn.sync_schedule ?? "Manual"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[conn.status] ?? "muted"}>{conn.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {conn.type === "csv" && (
                      <form action={syncCsvConnection} className="flex items-center gap-2">
                        <input type="hidden" name="connection_id" value={conn.id} />
                        <input
                          type="file"
                          name="file"
                          accept=".csv,text/csv"
                          required
                          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
                        />
                        <Button type="submit" size="sm">
                          Sync
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No connections yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Add a connection</CardTitle>
          <p className="text-sm text-muted-foreground">
            Only the <code className="text-xs">csv</code> type has a working sync today — upload a
            POS export and it upserts into <code className="text-xs">pos_daily_totals</code> using
            the field mapping below. Other types can be recorded here for tracking but have no
            automated sync yet.
          </p>
        </CardHeader>
        <CardContent>
          <form action={createConnection} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="conn-name">Name</Label>
              <Input id="conn-name" name="name" required placeholder="e.g. Semtek POS" />
            </div>
            <div>
              <Label htmlFor="conn-type">Type</Label>
              <Select id="conn-type" name="type" required defaultValue="csv">
                <option value="csv">CSV upload</option>
                <option value="postgres">Postgres</option>
                <option value="rest_api">REST API</option>
                <option value="webhook">Webhook</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="conn-field-mapping">
                Field mapping (JSON — for CSV: date, location, payment_method, total column names)
              </Label>
              <Textarea
                id="conn-field-mapping"
                name="field_mapping"
                rows={3}
                defaultValue={'{\n  "date": "Date",\n  "location": "Location",\n  "payment_method": "Method",\n  "total": "Total"\n}'}
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="conn-config">Config (JSON — credentials/settings, empty for CSV)</Label>
              <Textarea id="conn-config" name="config" rows={2} defaultValue="{}" className="font-mono" />
            </div>
            <div>
              <Label htmlFor="conn-schedule">Sync schedule (cron, optional — leave blank for manual)</Label>
              <Input id="conn-schedule" name="sync_schedule" placeholder="0 6 * * *" />
            </div>
            <Button type="submit" className="self-start">
              Add connection
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
