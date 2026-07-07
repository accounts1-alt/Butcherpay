import { supabaseServer } from "@/lib/supabase/server";
import type { EntryRow, MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
import { resolveDateRange, type DateRangeKind } from "@/lib/dateRanges";
import { nextLifecycleStage } from "@/lib/lifecycle";
import { formatMoney } from "@/lib/money";
import { advanceLifecycleGroup } from "./actions";

export const dynamic = "force-dynamic";

type Group = {
  key: string;
  date: string;
  paymentMethodName: string;
  payee: string;
  lifecycleStatus: string;
  nextStage: string | null;
  amount: number;
  fee: number;
  net: number;
  entryIds: string[];
};

export default async function LifecyclePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const rangeKind = (params.range as DateRangeKind) || "month";
  const { from, to } = resolveDateRange(rangeKind, new Date(), {
    from: params.from,
    to: params.to,
  });

  const supabase = supabaseServer();

  const [{ data: entries, error: entriesError }, { data: paymentMethods, error: pmError }, { data: merchants, error: merchError }] =
    await Promise.all([
      supabase.from("entries").select("*").gte("date", from).lte("date", to).order("date"),
      supabase.from("payment_methods").select("*"),
      supabase.from("merchants").select("*"),
    ]);

  if (entriesError) throw new Error(entriesError.message);
  if (pmError) throw new Error(pmError.message);
  if (merchError) throw new Error(merchError.message);

  const paymentMethodById = new Map(
    ((paymentMethods ?? []) as PaymentMethodRow[]).map((pm) => [pm.id, pm])
  );
  const merchantById = new Map(((merchants ?? []) as MerchantRow[]).map((m) => [m.id, m]));

  const groups = new Map<string, Group>();
  for (const entry of (entries ?? []) as EntryRow[]) {
    const method = paymentMethodById.get(entry.payment_method_id);
    if (!method) continue;

    const payee = entry.merchant_id
      ? (merchantById.get(entry.merchant_id)?.name ?? "—")
      : method.name;
    const key = `${entry.date}|${method.id}|${entry.merchant_id ?? ""}|${entry.lifecycle_status}`;

    const existing = groups.get(key);
    if (existing) {
      existing.amount += entry.amount;
      existing.fee += entry.fee;
      existing.net += entry.net;
      existing.entryIds.push(entry.id);
    } else {
      groups.set(key, {
        key,
        date: entry.date,
        paymentMethodName: method.name,
        payee,
        lifecycleStatus: entry.lifecycle_status,
        nextStage: nextLifecycleStage(method.lifecycle_stages, entry.lifecycle_status),
        amount: entry.amount,
        fee: entry.fee,
        net: entry.net,
        entryIds: [entry.id],
      });
    }
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lifecycle</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1" htmlFor="range">
            Range
          </label>
          <select
            id="range"
            name="range"
            defaultValue={rangeKind}
            className="border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="from">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
          />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="to">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
          />
        </div>
        <button type="submit" className="rounded bg-foreground text-background px-3 py-1.5 text-sm">
          Apply
        </button>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Payment method</th>
            <th className="py-2 pr-4">Merchant / payee</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Fee</th>
            <th className="py-2 pr-4">Net</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map((group) => (
            <tr key={group.key} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4 whitespace-nowrap">{group.date}</td>
              <td className="py-2 pr-4">{group.paymentMethodName}</td>
              <td className="py-2 pr-4">{group.payee}</td>
              <td className="py-2 pr-4">{formatMoney(group.amount)}</td>
              <td className="py-2 pr-4">{formatMoney(group.fee)}</td>
              <td className="py-2 pr-4">{formatMoney(group.net)}</td>
              <td className="py-2 pr-4 capitalize">{group.lifecycleStatus}</td>
              <td className="py-2">
                {group.nextStage ? (
                  <form action={advanceLifecycleGroup}>
                    <input type="hidden" name="entry_ids" value={group.entryIds.join(",")} />
                    <input type="hidden" name="next_stage" value={group.nextStage} />
                    <button type="submit" className="text-xs underline capitalize">
                      Mark {group.nextStage}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-black/40 dark:text-white/40">Complete</span>
                )}
              </td>
            </tr>
          ))}
          {sortedGroups.length === 0 && (
            <tr>
              <td colSpan={8} className="py-4 text-black/50 dark:text-white/50">
                No entries in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
