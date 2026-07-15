import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionRow, Database } from "@/lib/supabase/types";
import { syncStripeConnection } from "./stripeSync";
import { syncPostgresConnection } from "./postgresSync";

export type SyncResult = { ok: true } | { ok: false; error: string };

// Single place that knows how to run any automated (non-CSV) connection type
// for a given date, and marks the connection healthy/failing afterwards.
// Shared by the daily cron job and the manual "Sync now" action so the two
// never drift apart. Never throws -- the outcome (including the error
// message) is persisted on the connection row itself, since Next.js redacts
// thrown Server Action errors to a generic message in production and there's
// no other way to see why a sync failed.
export async function syncConnection(
  supabase: SupabaseClient<Database>,
  connection: ConnectionRow,
  date: string
): Promise<SyncResult> {
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
      .update({ last_synced_at: new Date().toISOString(), status: "healthy", last_error: null })
      .eq("id", connection.id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("connections")
      .update({ status: "failing", last_error: message })
      .eq("id", connection.id);
    return { ok: false, error: message };
  }
}

export function yesterdayUTC(): string {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday.toISOString().slice(0, 10);
}
