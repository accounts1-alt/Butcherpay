"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { EntryDirection, EntryType } from "@/lib/supabase/types";

export async function createEntry(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const direction = String(formData.get("direction") ?? "") as EntryDirection;
  const type = String(formData.get("type") ?? "") as EntryType;
  const payment_method_id = String(formData.get("payment_method_id") ?? "");
  const merchantRaw = formData.get("merchant_id");
  const merchant_id = merchantRaw ? String(merchantRaw) : null;
  const amount = Number(formData.get("amount") ?? 0);
  const fee = Number(formData.get("fee") ?? 0);
  const lifecycle_status = String(formData.get("lifecycle_status") ?? "");
  const notesRaw = formData.get("notes");
  const notes = notesRaw ? String(notesRaw) : null;

  if (!date || !location || !direction || !type || !payment_method_id || !lifecycle_status) {
    throw new Error("Missing required fields");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  const { error } = await supabaseServer().from("entries").insert({
    date,
    location,
    direction,
    type,
    payment_method_id,
    merchant_id,
    amount,
    fee: Number.isFinite(fee) ? fee : 0,
    lifecycle_status,
    notes,
  });

  if (error) throw new Error(error.message);

  redirect("/entries/new?success=1");
}
