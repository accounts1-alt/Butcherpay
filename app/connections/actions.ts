"use server";

import Papa from "papaparse";
import { redirect } from "next/navigation";
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

// Shared by create and update: builds config/field_mapping/sync_schedule
// from the type-specific form fields. For edits, an empty secret_key or
// connection_string means "leave the existing value alone" (the form shows
// these masked and blank rather than round-tripping the real secret back to
// the client).
function connectionFieldsFromForm(
  formData: FormData,
  type: ConnectionType,
  existingConfig?: Record<string, unknown>
): { config: Record<string, unknown>; field_mapping: Record<string, unknown>; sync_schedule: string | null } {
  if (type === "rest_api") {
    const secret_key = String(formData.get("secret_key") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    if (!location) throw new Error("Stripe connections need a location");
    if (!secret_key && !existingConfig?.secret_key) {
      throw new Error("Stripe connections need an API key");
    }
    return {
      config: {
        provider: "stripe",
        secret_key: secret_key || existingConfig?.secret_key,
        location,
      },
      field_mapping: {},
      sync_schedule: "0 5 * * *",
    };
  }

  if (type === "postgres") {
    const connection_string = String(formData.get("connection_string") ?? "").trim();
    const query = String(formData.get("query") ?? "").trim();
    if (!query) throw new Error("Postgres connections need a query");
    if (!connection_string && !existingConfig?.connection_string) {
      throw new Error("Postgres connections need a connection string");
    }
    return {
      config: {
        connection_string: connection_string || existingConfig?.connection_string,
        query,
      },
      field_mapping: fieldMappingFromForm(formData),
      sync_schedule: "0 5 * * *",
    };
  }

  if (type === "csv") {
    return { config: {}, field_mapping: fieldMappingFromForm(formData), sync_schedule: null };
  }

  return { config: {}, field_mapping: {}, sync_schedule: null };
}

export async function createConnection(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ConnectionType;

  if (!name || !type) throw new Error("Name and type are required");

  const { config, field_mapping, sync_schedule } = connectionFieldsFromForm(formData, type);

  const { error } = await supabaseServer()
    .from("connections")
    .insert({ name, type, config, field_mapping, sync_schedule });

  if (error) throw new Error(error.message);
  revalidatePath("/connections");
}

export async function updateConnection(formData: FormData) {
  const connectionId = String(formData.get("connection_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ConnectionType;
  if (!connectionId || !name || !type) throw new Error("Missing connection, name, or type");

  const supabase = supabaseServer();
  const { data: existing, error: fetchError } = await supabase
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { config, field_mapping, sync_schedule } = connectionFieldsFromForm(
    formData,
    type,
    existing.config
  );

  const { error } = await supabase
    .from("connections")
    .update({ name, type, config, field_mapping, sync_schedule })
    .eq("id", connectionId);
  if (error) throw new Error(error.message);

  revalidatePath("/connections");
  redirect("/connections");
}

export async function deleteConnection(formData: FormData) {
  const connectionId = String(formData.get("connection_id") ?? "");
  if (!connectionId) throw new Error("Missing connection");

  const { error } = await supabaseServer().from("connections").delete().eq("id", connectionId);
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
    await supabase
      .from("connections")
      .update({
        status: "failing",
        last_error: "field_mapping must have date, location, payment_method, and total keys",
      })
      .eq("id", connectionId);
    revalidatePath("/connections");
    return;
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
      .update({ last_synced_at: new Date().toISOString(), status: "healthy", last_error: null })
      .eq("id", connectionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("connections")
      .update({ status: "failing", last_error: message })
      .eq("id", connectionId);
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
