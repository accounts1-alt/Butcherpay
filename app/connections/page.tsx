import { supabaseServer } from "@/lib/supabase/server";
import type { ConnectionRow } from "@/lib/supabase/types";
import { createConnection, syncCsvConnection } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  healthy: "text-green-700 dark:text-green-400",
  failing: "text-red-700 dark:text-red-400",
  disabled: "text-black/40 dark:text-white/40",
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
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold">Connections</h1>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Schedule</th>
            <th className="py-2 pr-4">Last synced</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((conn) => (
            <tr key={conn.id} className="border-b border-black/5 dark:border-white/5 align-top">
              <td className="py-2 pr-4">{conn.name}</td>
              <td className="py-2 pr-4">{conn.type}</td>
              <td className="py-2 pr-4">{conn.sync_schedule ?? "Manual"}</td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : "Never"}
              </td>
              <td className={`py-2 pr-4 ${STATUS_STYLES[conn.status] ?? ""}`}>{conn.status}</td>
              <td className="py-2">
                {conn.type === "csv" && (
                  <form action={syncCsvConnection} className="flex items-center gap-2">
                    <input type="hidden" name="connection_id" value={conn.id} />
                    <input type="file" name="file" accept=".csv,text/csv" required className="text-xs" />
                    <button type="submit" className="rounded bg-foreground text-background px-2 py-1 text-xs">
                      Sync
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-3 text-black/50 dark:text-white/50">
                No connections yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Add a connection</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Only the <code>csv</code> type has a working sync today — upload a POS export and it
          upserts into <code>pos_daily_totals</code> using the field mapping below. Other types can
          be recorded here for tracking but have no automated sync yet.
        </p>
        <form action={createConnection} className="flex flex-col gap-3 max-w-lg">
          <div>
            <label className="block text-xs mb-1" htmlFor="conn-name">
              Name
            </label>
            <input
              id="conn-name"
              name="name"
              required
              placeholder="e.g. Semtek POS"
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="conn-type">
              Type
            </label>
            <select
              id="conn-type"
              name="type"
              required
              defaultValue="csv"
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
            >
              <option value="csv">CSV upload</option>
              <option value="postgres">Postgres</option>
              <option value="rest_api">REST API</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="conn-field-mapping">
              Field mapping (JSON — for CSV: date, location, payment_method, total column names)
            </label>
            <textarea
              id="conn-field-mapping"
              name="field_mapping"
              rows={3}
              defaultValue={'{\n  "date": "Date",\n  "location": "Location",\n  "payment_method": "Method",\n  "total": "Total"\n}'}
              className="w-full border rounded px-2 py-1.5 text-sm font-mono border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="conn-config">
              Config (JSON — credentials/settings, empty for CSV)
            </label>
            <textarea
              id="conn-config"
              name="config"
              rows={2}
              defaultValue="{}"
              className="w-full border rounded px-2 py-1.5 text-sm font-mono border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="conn-schedule">
              Sync schedule (cron, optional — leave blank for manual)
            </label>
            <input
              id="conn-schedule"
              name="sync_schedule"
              placeholder="0 6 * * *"
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <button
            type="submit"
            className="self-start rounded bg-foreground text-background px-3 py-1.5 text-sm"
          >
            Add connection
          </button>
        </form>
      </section>
    </div>
  );
}
