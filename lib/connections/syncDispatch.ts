import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionRow, Database } from "@/lib/supabase/types";
import { syncStripeConnection } from "./stripeSync";
import { syncPostgresConnection } from "./postgresSync";

// Single place that knows how to run any automated (non-CSV) connection type
// for a given date, and marks the connection healthy/failing afterwards.
// Shared by the daily cron job and the manual "Sync now" action so the two
// never drift apart.
export async function syncConnection(
  supabase: SupabaseClient<Database>,
  connection: ConnectionRow,
  date: string
): Promise<void> {
  try {
    if (connection.type === "rest_api") {
      const provider = (connection.config as Record<string, unknown> | null)?.provider;
      if (provider === "stripe") {
        await syncStripeConnection(supabase, connection, date);
      } else {
        throw new Error(`Unsupported rest_api provider: ${String(provider)}`);
      }
    } else if (connection.type === "postgres") {
      await syncPostgresConnection(supabase, connection, date);
    } else {
      throw new Error(`No automated sync for connection type: ${connection.type}`);
    }

    await supabase
      .from("connections")
      .update({ last_synced_at: new Date().toISOString(), status: "healthy" })
      .eq("id", connection.id);
  } catch (err) {
    await supabase.from("connections").update({ status: "failing" }).eq("id", connection.id);
    throw err;
  }
}

export function yesterdayUTC(): string {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday.toISOString().slice(0, 10);
}
