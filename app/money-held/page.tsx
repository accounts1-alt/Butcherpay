import { supabaseServer } from "@/lib/supabase/server";
import type { AdjustmentRow, EntryRow, PaymentMethodRow } from "@/lib/supabase/types";
import { effectiveNet } from "@/lib/effectiveAmount";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MoneyHeldPage() {
  const supabase = supabaseServer();

  const { data: paymentMethods, error: pmError } = await supabase
    .from("payment_methods")
    .select("*");
  if (pmError) throw new Error(pmError.message);

  const methods = (paymentMethods ?? []) as PaymentMethodRow[];
  const finalStageByMethod = new Map(
    methods.map((m) => [m.id, m.lifecycle_stages[m.lifecycle_stages.length - 1]])
  );

  const { data: entries, error: entriesError } = await supabase
    .from("entries")
    .select("*")
    .eq("direction", "in");
  if (entriesError) throw new Error(entriesError.message);

  const heldEntries = (entries ?? []).filter(
    (e) => e.lifecycle_status !== finalStageByMethod.get(e.payment_method_id)
  ) as EntryRow[];

  const { data: adjustments, error: adjError } = await supabase
    .from("adjustments")
    .select("*")
    .in(
      "entry_id",
      heldEntries.length > 0 ? heldEntries.map((e) => e.id) : ["00000000-0000-0000-0000-000000000000"]
    );
  if (adjError) throw new Error(adjError.message);

  const latestAdjustmentByEntry = new Map<string, AdjustmentRow>();
  for (const adj of (adjustments ?? []) as AdjustmentRow[]) {
    const existing = latestAdjustmentByEntry.get(adj.entry_id);
    if (!existing || adj.adjusted_at > existing.adjusted_at) {
      latestAdjustmentByEntry.set(adj.entry_id, adj);
    }
  }

  const heldByMethod = new Map<string, number>();
  for (const entry of heldEntries) {
    const net = effectiveNet(entry, latestAdjustmentByEntry.get(entry.id));
    heldByMethod.set(entry.payment_method_id, (heldByMethod.get(entry.payment_method_id) ?? 0) + net);
  }

  const rows = methods
    .map((m) => ({ method: m, held: heldByMethod.get(m.id) ?? 0 }))
    .filter((row) => row.held !== 0)
    .sort((a, b) => b.held - a.held);

  const grandTotal = rows.reduce((sum, row) => sum + row.held, 0);

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold">Money currently held</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Money taken but not yet banked, by payment method.
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-black/10 dark:border-white/10">
            <th className="py-2">Payment method</th>
            <th className="py-2 text-right">Held</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.method.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2">{row.method.name}</td>
              <td className="py-2 text-right">{formatMoney(row.held)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="py-4 text-black/50 dark:text-white/50">
                Nothing currently held — everything is banked.
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-black/10 dark:border-white/10 font-medium">
              <td className="py-2">Total</td>
              <td className="py-2 text-right">{formatMoney(grandTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
