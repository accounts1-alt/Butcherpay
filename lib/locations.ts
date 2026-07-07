import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const DEFAULT_LOCATIONS = ["Shop", "Unit"];

export async function listKnownLocations(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const [{ data: entryLocations, error: entryErr }, { data: posLocations, error: posErr }] =
    await Promise.all([
      supabase.from("entries").select("location").limit(1000),
      supabase.from("pos_daily_totals").select("location").limit(1000),
    ]);

  if (entryErr) throw new Error(entryErr.message);
  if (posErr) throw new Error(posErr.message);

  return Array.from(
    new Set([
      ...DEFAULT_LOCATIONS,
      ...(entryLocations ?? []).map((e) => e.location),
      ...(posLocations ?? []).map((p) => p.location),
    ])
  );
}
