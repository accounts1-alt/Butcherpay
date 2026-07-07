export type PosCsvFieldMapping = {
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

export function isPosCsvFieldMapping(value: unknown): value is PosCsvFieldMapping {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === "string" &&
    typeof v.location === "string" &&
    typeof v.payment_method === "string" &&
    typeof v.total === "string"
  );
}

// Maps CSV rows (already parsed to header -> value objects) to pos_daily_totals
// candidates using a connection's field_mapping. Rows missing a mapped value,
// or with a non-numeric total, are dropped rather than inserted as zeros.
export function mapCsvRows(
  rows: Record<string, string>[],
  mapping: PosCsvFieldMapping
): ParsedPosRow[] {
  return rows
    .map((row) => ({
      date: row[mapping.date]?.trim() ?? "",
      location: row[mapping.location]?.trim() ?? "",
      paymentMethodName: row[mapping.payment_method]?.trim() ?? "",
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
