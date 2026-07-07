import { supabaseServer } from "@/lib/supabase/server";
import type { AdjustmentRow, EntryRow, MerchantRow, ReconciliationTotalRow } from "@/lib/supabase/types";
import { reconcile } from "@/lib/reconciliation";
import { formatMoney } from "@/lib/money";
import { createAdjustment } from "./actions";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; location?: string; paymentMethodId?: string }>;
}) {
  const { date, location, paymentMethodId } = await searchParams;

  if (!date || !location || !paymentMethodId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-2">Transaction detail</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Missing date, location, or payment method. Open this page from the{" "}
          <a className="underline" href="/dashboard">
            Dashboard
          </a>
          .
        </p>
      </div>
    );
  }

  const supabase = supabaseServer();

  const [
    { data: paymentMethod, error: pmError },
    { data: entries, error: entriesError },
    { data: merchants, error: merchError },
    { data: totalsRows, error: totalsError },
  ] = await Promise.all([
    supabase.from("payment_methods").select("*").eq("id", paymentMethodId).single(),
    supabase
      .from("entries")
      .select("*")
      .eq("date", date)
      .eq("location", location)
      .eq("payment_method_id", paymentMethodId)
      .order("created_at"),
    supabase.from("merchants").select("*"),
    supabase
      .from("reconciliation_totals")
      .select("*")
      .eq("date", date)
      .eq("location", location)
      .eq("payment_method_id", paymentMethodId),
  ]);

  if (pmError) throw new Error(pmError.message);
  if (entriesError) throw new Error(entriesError.message);
  if (merchError) throw new Error(merchError.message);
  if (totalsError) throw new Error(totalsError.message);

  const entryRows = (entries ?? []) as EntryRow[];
  const merchantById = new Map((merchants as MerchantRow[] | null ?? []).map((m) => [m.id, m]));

  const { data: adjustments, error: adjError } = await supabase
    .from("adjustments")
    .select("*")
    .in("entry_id", entryRows.length > 0 ? entryRows.map((e) => e.id) : ["00000000-0000-0000-0000-000000000000"]);
  if (adjError) throw new Error(adjError.message);

  const adjustmentsByEntry = new Map<string, AdjustmentRow[]>();
  for (const adj of (adjustments ?? []) as AdjustmentRow[]) {
    const list = adjustmentsByEntry.get(adj.entry_id) ?? [];
    list.push(adj);
    adjustmentsByEntry.set(adj.entry_id, list);
  }

  const totalsRow = (totalsRows as ReconciliationTotalRow[] | null)?.[0];
  const { posTotal, recordedTotal, gap, matched } = reconcile(
    totalsRow?.pos_total ?? 0,
    totalsRow?.recorded_total ?? 0
  );

  const returnTo = `/transactions?date=${date}&location=${encodeURIComponent(location)}&paymentMethodId=${paymentMethodId}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {date} · {location} · {paymentMethod?.name}
        </h1>
      </div>

      <div className="flex gap-8 rounded border border-black/10 dark:border-white/10 p-4 text-sm">
        <div>
          <div className="text-black/50 dark:text-white/50">POS total</div>
          <div className="font-medium">{formatMoney(posTotal)}</div>
        </div>
        <div>
          <div className="text-black/50 dark:text-white/50">Recorded total</div>
          <div className="font-medium">{formatMoney(recordedTotal)}</div>
        </div>
        <div>
          <div className="text-black/50 dark:text-white/50">Gap</div>
          <div className={`font-medium ${matched ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
            {formatMoney(gap)} {matched ? "(matched)" : ""}
          </div>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-4">Ref</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Merchant</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Fee</th>
            <th className="py-2 pr-4">Net</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Reconciles</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {entryRows.map((entry) => {
            const merchant = entry.merchant_id ? merchantById.get(entry.merchant_id) : undefined;
            const entryAdjustments = adjustmentsByEntry.get(entry.id) ?? [];
            const latestAdjustment = entryAdjustments[entryAdjustments.length - 1];
            return (
              <tr key={entry.id} className="border-b border-black/5 dark:border-white/5 align-top">
                <td className="py-2 pr-4">#{entry.reference}</td>
                <td className="py-2 pr-4">{entry.type}</td>
                <td className="py-2 pr-4">{merchant?.name ?? "—"}</td>
                <td className="py-2 pr-4">
                  {formatMoney(entry.amount)}
                  {latestAdjustment && (
                    <span className="block text-xs text-black/50 dark:text-white/50">
                      corrected to {formatMoney(latestAdjustment.corrected_amount)}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{formatMoney(entry.fee)}</td>
                <td className="py-2 pr-4">{formatMoney(entry.net)}</td>
                <td className="py-2 pr-4">{entry.lifecycle_status}</td>
                <td className="py-2 pr-4">{entry.reconciles_against_pos ? "Yes" : "No"}</td>
                <td className="py-2">
                  <details>
                    <summary className="cursor-pointer text-xs underline">Adjust</summary>
                    <form action={createAdjustment} className="mt-2 flex flex-col gap-2 w-56">
                      <input type="hidden" name="entry_id" value={entry.id} />
                      <input type="hidden" name="original_amount" value={entry.amount} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <label className="text-xs">
                        Corrected amount
                        <input
                          name="corrected_amount"
                          type="number"
                          step="0.01"
                          required
                          defaultValue={entry.amount}
                          className="w-full mt-0.5 border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
                        />
                      </label>
                      <label className="text-xs">
                        Reason
                        <input
                          name="reason"
                          required
                          className="w-full mt-0.5 border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded bg-foreground text-background px-2 py-1 text-xs"
                      >
                        Save adjustment
                      </button>
                    </form>
                    {entryAdjustments.length > 0 && (
                      <ul className="mt-2 text-xs text-black/60 dark:text-white/60 space-y-1">
                        {entryAdjustments.map((adj) => (
                          <li key={adj.id}>
                            {formatMoney(adj.original_amount)} → {formatMoney(adj.corrected_amount)}: {adj.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </td>
              </tr>
            );
          })}
          {entryRows.length === 0 && (
            <tr>
              <td colSpan={9} className="py-4 text-black/50 dark:text-white/50">
                No entries recorded for this date, location, and payment method.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
