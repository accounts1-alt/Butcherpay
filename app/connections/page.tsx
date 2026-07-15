import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { ConnectionRow } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConnectionForm } from "./ConnectionForm";
import { DeleteConnectionButton } from "./DeleteConnectionButton";
import { createConnection, syncCsvConnection, syncConnectionNow } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "muted"> = {
  healthy: "success",
  failing: "destructive",
  disabled: "muted",
};

const TYPE_LABEL: Record<string, string> = {
  csv: "CSV",
  rest_api: "API",
  postgres: "Postgres",
  webhook: "Webhook",
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
          External systems this app reads POS totals from. Stripe and Postgres connections sync
          automatically once a day; CSV is manual/backfill only.
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
                  <TableCell className="text-xs text-muted-foreground">
                    {TYPE_LABEL[conn.type] ?? conn.type}
                  </TableCell>
                  <TableCell>{conn.sync_schedule ? "Daily" : "Manual"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[conn.status] ?? "muted"}>{conn.status}</Badge>
                    {conn.status === "failing" && conn.last_error && (
                      <p className="mt-1 max-w-xs text-xs text-destructive break-words">
                        {conn.last_error}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-2">
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
                      {(conn.type === "postgres" || conn.type === "rest_api") && (
                        <form action={syncConnectionNow}>
                          <input type="hidden" name="connection_id" value={conn.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Sync now
                          </Button>
                        </form>
                      )}
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/connections/${conn.id}/edit`}
                          className={buttonVariants({ size: "sm", variant: "ghost" })}
                        >
                          Edit
                        </Link>
                        <DeleteConnectionButton connectionId={conn.id} name={conn.name} />
                      </div>
                    </div>
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

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Add a connection</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectionForm action={createConnection} submitLabel="Add connection" />
        </CardContent>
      </Card>
    </div>
  );
}
