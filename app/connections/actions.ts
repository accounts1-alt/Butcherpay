"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { isPosCsvFieldMapping, mapCsvRows } from "@/lib/csvSync";
import type { ConnectionType } from "@/lib/supabase/types";

export async function createConnection(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ConnectionType;
  const configRaw = String(formData.get("config") ?? "{}");
  const fieldMappingRaw = String(formData.get("field_mapping") ?? "{}");
  const sync_scheduleRaw = formData.get("sync_schedule");
  const sync_schedule = sync_scheduleRaw ? String(sync_scheduleRaw).trim() || null : null;

  if (!name || !type) throw new Error("Name and type are required");

  let config: Record<string, unknown>;
  let field_mapping: Record<string, unknown>;
  try {
    config = JSON.parse(configRaw);
    field_mapping = JSON.parse(fieldMappingRaw);
  } catch {
    throw new Error("Config and field mapping must be valid JSON");
  }

  const { error } = await supabaseServer()
    .from("connections")
    .insert({ name, type, config, field_mapping, sync_schedule });

  if (error) throw new Error(error.message);
  revalidatePath("/connections");
}

export async function syncCsvConnection(formData: FormData) {
  const connectionId = String(formData.get("connection_id") ?? "");
  const file = formData.get("file") as File | null;

  if (!connectionId || !file || file.size === 0) {
    throw new Error("A connection and a non-empty CSV file are required");
  }

  const supabase = supabaseServer();

  const { data: connection, error: connError } = await supabase
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (connError) throw new Error(connError.message);

  if (!isPosCsvFieldMapping(connection.field_mapping)) {
    throw new Error(
      "This connection's field_mapping must have date, location, payment_method, and total keys"
    );
  }

  try {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
    }

    const rows = mapCsvRows(parsed.data, connection.field_mapping);

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
      throw new Error("No rows matched a known payment method — check the CSV and field mapping");
    }

    const { error: upsertError } = await supabase
      .from("pos_daily_totals")
      .upsert(upsertRows, { onConflict: "date,location,payment_method_id" });
    if (upsertError) throw new Error(upsertError.message);

    await supabase
      .from("connections")
      .update({ last_synced_at: new Date().toISOString(), status: "healthy" })
      .eq("id", connectionId);
  } catch (err) {
    await supabase.from("connections").update({ status: "failing" }).eq("id", connectionId);
    throw err;
  }

  revalidatePath("/connections");
  revalidatePath("/dashboard");
}
