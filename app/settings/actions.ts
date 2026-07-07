"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

function parseStages(raw: string): string[] {
  return raw
    .split(",")
    .map((stage) => stage.trim().toLowerCase())
    .filter(Boolean);
}

export async function createPaymentMethod(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const stages = parseStages(String(formData.get("lifecycle_stages") ?? ""));

  if (!name || stages.length === 0) {
    throw new Error("Name and at least one lifecycle stage are required");
  }

  const { error } = await supabaseServer()
    .from("payment_methods")
    .insert({ name, lifecycle_stages: stages });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setPaymentMethodActive(id: string, active: boolean) {
  const { error } = await supabaseServer()
    .from("payment_methods")
    .update({ active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function createMerchant(formData: FormData) {
  const payment_method_id = String(formData.get("payment_method_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const fee_type = String(formData.get("fee_type") ?? "percent") as
    | "percent"
    | "fixed"
    | "none";
  const fee_value = Number(formData.get("fee_value") ?? 0);

  if (!payment_method_id || !name) {
    throw new Error("Payment method and name are required");
  }

  const { error } = await supabaseServer()
    .from("merchants")
    .insert({ payment_method_id, name, fee_type, fee_value });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setMerchantActive(id: string, active: boolean) {
  const { error } = await supabaseServer()
    .from("merchants")
    .update({ active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
