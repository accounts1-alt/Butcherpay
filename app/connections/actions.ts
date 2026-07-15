"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { isPosFieldMapping, mapRows, upsertPosDailyTotals } from "@/lib/posSync";
import { syncConnection, yesterdayUTC } from "@/lib/connections/syncDispatch";
import type { ConnectionType } from "@/lib/supabase/types";

function fieldMappingFromForm(formData: FormData): Record<string, string> {
  return {
    date: String(formData.get("date_col") ?? "").trim(),
    location: String(formData.get("location_col") ?? "").trim(),
    payment_method: String(formData.get("method_col") ?? "").trim(),
    total: String(formData.get("total_col") ?? "").trim(),
  };
}

export async function createConnection(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ConnectionType;

  if (!name || !type) throw new Error("Name and type are required");

  let config: Record<string, unknown> = {};
  let field_mapping: Record<string, unknown> = {};
  // The cron job runs once daily for every non-CSV connection — there's no
  // per-connection schedule to configure, this is purely descriptive.
  let sync_schedule: string | null = null;

  if (type === "csv") {
    field_mapping = fieldMappingFromForm(formData);
  } else if (type === "rest_api") {
    const secret_key = String(formData.get("secret_key") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    if (!secret_key || !location) {
      throw new Error("Stripe connections need an API key and a location");
    }
    config = { provider: "stripe", secret_key, location };
    sync_schedule = "0 5 * * *";
  } else if (type === "postgres") {
    const connection_string = String(formData.get("connection_string") ?? "").trim();
    const query = String(formData.get("query") ?? "").trim();
    if (!connection_string || !query) {
      throw new Error("Postgres connections need a connection string and a query");
    }
    config = { connection_string, query };
    field_mapping = fieldMappingFromForm(formData);
    sync_schedule = "0 5 * * *";
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

  if (!isPosFieldMapping(connection.field_mapping)) {
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

    const rows = mapRows(parsed.data, connection.field_mapping);
    await upsertPosDailyTotals(supabase, connectionId, rows);

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

export async function syncConnectionNow(formData: FormData) {
  const connectionId = String(formData.get("connection_id") ?? "");
  const dateRaw = formData.get("date");
  const date = dateRaw ? String(dateRaw) : yesterdayUTC();

  if (!connectionId) throw new Error("Missing connection");

  const supabase = supabaseServer();
  const { data: connection, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (error) throw new Error(error.message);

  await syncConnection(supabase, connection, date);

  revalidatePath("/connections");
  revalidatePath("/dashboard");
}
