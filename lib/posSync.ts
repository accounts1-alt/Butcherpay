import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type PosFieldMapping = {
  date: string;
  location: string;
  payment_method: string;
  total: string;
};

export type ParsedPosRow = {
  date: string;
  location: string;
  paymentMethodName: string;
  total: number;
};

export function isPosFieldMapping(value: unknown): value is PosFieldMapping {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === "string" &&
    typeof v.location === "string" &&
    typeof v.payment_method === "string" &&
    typeof v.total === "string"
  );
}

function toTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

// Maps rows from any source (CSV, a Postgres query, an API response) to
// pos_daily_totals candidates using a connection's field_mapping. Rows
// missing a mapped value, or with a non-numeric total, are dropped rather
// than inserted as zeros.
export function mapRows(
  rows: Record<string, unknown>[],
  mapping: PosFieldMapping
): ParsedPosRow[] {
  return rows
    .map((row) => ({
      date: toTrimmedString(row[mapping.date]),
      location: toTrimmedString(row[mapping.location]),
      paymentMethodName: toTrimmedString(row[mapping.payment_method]),
      total: Number(row[mapping.total]),
    }))
    .filter(
      (row) =>
        row.date !== "" &&
        row.location !== "" &&
        row.paymentMethodName !== "" &&
        Number.isFinite(row.total)
    );
}

// Resolves each row's payment method name to an id and upserts into
// pos_daily_totals (on conflict on date/location/payment_method_id, matching
// its unique constraint, so re-syncs update rather than duplicate). Shared by
// every connection type so the upsert semantics never drift between them.
export async function upsertPosDailyTotals(
  supabase: SupabaseClient<Database>,
  connectionId: string,
  rows: ParsedPosRow[]
): Promise<{ upserted: number }> {
  const { data: paymentMethods, error: pmError } = await supabase
    .from("payment_methods")
    .select("*");
  if (pmError) throw new Error(pmError.message);

  const methodIdByName = new Map(
    paymentMethods.map((pm) => [pm.name.trim().toLowerCase(), pm.id])
  );

  const upsertRows = rows.flatMap((row) => {
    const payment_method_id = methodIdByName.get(row.paymentMethodName.toLowerCase());
    if (!payment_method_id) return [];
    return [
      {
        connection_id: connectionId,
        date: row.date,
        location: row.location,
        payment_method_id,
        total: row.total,
        synced_at: new Date().toISOString(),
      },
    ];
  });

  if (upsertRows.length === 0) {
    throw new Error("No rows matched a known payment method — check the source data and field mapping");
  }

  const { error: upsertError } = await supabase
    .from("pos_daily_totals")
    .upsert(upsertRows, { onConflict: "date,location,payment_method_id" });
  if (upsertError) throw new Error(upsertError.message);

  return { upserted: upsertRows.length };
}
