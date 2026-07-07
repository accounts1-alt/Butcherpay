import { supabaseServer } from "@/lib/supabase/server";
import type { MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
import { listKnownLocations } from "@/lib/locations";
import { EntryForm } from "./EntryForm";

export const dynamic = "force-dynamic";

async function loadData() {
  const supabase = supabaseServer();

  const [{ data: paymentMethods, error: pmError }, { data: merchants, error: merchError }, locations] =
    await Promise.all([
      supabase.from("payment_methods").select("*").eq("active", true).order("name"),
      supabase.from("merchants").select("*").eq("active", true).order("name"),
      listKnownLocations(supabase),
    ]);

  if (pmError) throw new Error(pmError.message);
  if (merchError) throw new Error(merchError.message);

  return {
    paymentMethods: (paymentMethods ?? []) as PaymentMethodRow[],
    merchants: (merchants ?? []) as MerchantRow[],
    locations,
  };
}

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { paymentMethods, merchants, locations } = await loadData();
  const { success } = await searchParams;

  if (paymentMethods.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold mb-2">Add an entry</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          No active payment methods yet. Add one in{" "}
          <a className="underline" href="/settings">
            Settings
          </a>{" "}
          first.
        </p>
      </div>
    );
  }

  return (
    <EntryForm
      paymentMethods={paymentMethods}
      merchants={merchants}
      locations={locations}
      successBanner={success === "1"}
    />
  );
}
