"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { EntryRow } from "@/lib/supabase/types";

export async function advanceLifecycleGroup(formData: FormData) {
  const entryIdsRaw = String(formData.get("entry_ids") ?? "");
  const nextStage = String(formData.get("next_stage") ?? "");
  const entryIds = entryIdsRaw.split(",").filter(Boolean);

  if (entryIds.length === 0 || !nextStage) {
    throw new Error("Missing entries or next stage");
  }

  const update: Partial<EntryRow> = { lifecycle_status: nextStage };
  if (nextStage === "posted") update.posted_at = new Date().toISOString();
  if (nextStage === "banked") update.banked_at = new Date().toISOString();

  const { error } = await supabaseServer().from("entries").update(update).in("id", entryIds);

  if (error) throw new Error(error.message);
  revalidatePath("/lifecycle");
  revalidatePath("/money-held");
}
