"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function createAdjustment(formData: FormData) {
  const entry_id = String(formData.get("entry_id") ?? "");
  const original_amount = Number(formData.get("original_amount") ?? 0);
  const corrected_amount = Number(formData.get("corrected_amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "/dashboard");

  if (!entry_id || !reason || !Number.isFinite(corrected_amount)) {
    throw new Error("Entry, corrected amount, and reason are required");
  }

  const { error } = await supabaseServer().from("adjustments").insert({
    entry_id,
    original_amount,
    corrected_amount,
    reason,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(returnTo);
}
