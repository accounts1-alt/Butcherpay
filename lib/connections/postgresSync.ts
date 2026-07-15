import { Client } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionRow, Database } from "@/lib/supabase/types";
import { isPosFieldMapping, mapRows, upsertPosDailyTotals } from "@/lib/posSync";

export type PostgresConnectionConfig = {
  connection_string: string;
  // Must be a parameterized query using $1 for the target date, returning
  // columns matching the connection's field_mapping, e.g.:
  //   select till_date, site, tender_type, amount from pos_totals where till_date = $1
  query: string;
  // Optional PEM CA certificate (e.g. Supabase's, from Database Settings ->
  // SSL Configuration). Supabase's pooler presents a chain that Node's
  // default trust store rejects as "self-signed certificate in certificate
  // chain" unless this is supplied -- providing it keeps verification on
  // (rejectUnauthorized stays true) rather than disabling it.
  ca_certificate?: string;
};

export function isPostgresConnectionConfig(value: unknown): value is PostgresConnectionConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.connection_string === "string" &&
    v.connection_string.length > 0 &&
    typeof v.query === "string" &&
    v.query.length > 0 &&
    (v.ca_certificate === undefined || typeof v.ca_certificate === "string")
  );
}

// Reads from any external Postgres database (e.g. a POS table synced there by
// a third-party ETL tool like Skyvia) using a connection-supplied,
// parameterized query, then maps and upserts exactly like the CSV path.
export async function syncPostgresConnection(
  supabase: SupabaseClient<Database>,
  connection: ConnectionRow,
  date: string
): Promise<{ upserted: number }> {
  if (!isPostgresConnectionConfig(connection.config)) {
    throw new Error("Postgres connection config must include connection_string and query");
  }
  if (!isPosFieldMapping(connection.field_mapping)) {
    throw new Error(
      "Postgres connection field_mapping must have date, location, payment_method, and total keys"
    );
  }

  const client = new Client({
    connectionString: connection.config.connection_string,
    ssl: connection.config.ca_certificate
      ? { ca: connection.config.ca_certificate, rejectUnauthorized: true }
      : undefined,
  });
  await client.connect();

  let rows: Record<string, unknown>[];
  try {
    const result = await client.query(connection.config.query, [date]);
    rows = result.rows;
  } finally {
    await client.end();
  }

  const parsed = mapRows(rows, connection.field_mapping);
  return upsertPosDailyTotals(supabase, connection.id, parsed);
}
