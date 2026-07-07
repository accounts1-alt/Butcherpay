import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { PaymentMethodRow, ReconciliationTotalRow } from "@/lib/supabase/types";
import { listKnownLocations } from "@/lib/locations";
import { resolveDateRange, type DateRangeKind } from "@/lib/dateRanges";
import { reconcile } from "@/lib/reconciliation";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    location?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = supabaseServer();

  const [{ data: paymentMethods, error: pmError }, locations] = await Promise.all([
    supabase.from("payment_methods").select("*").eq("active", true).order("name"),
    listKnownLocations(supabase),
  ]);
  if (pmError) throw new Error(pmError.message);

  const methods = (paymentMethods ?? []) as PaymentMethodRow[];
  const location = params.location || locations[0] || "Shop";
  const rangeKind = (params.range as DateRangeKind) || "week";
  const { from, to } = resolveDateRange(rangeKind, new Date(), {
    from: params.from,
    to: params.to,
  });

  const { data: totals, error: totalsError } = await supabase
    .from("reconciliation_totals")
    .select("*")
    .eq("location", location)
    .gte("date", from)
    .lte("date", to);
  if (totalsError) throw new Error(totalsError.message);

  const totalsByKey = new Map<string, ReconciliationTotalRow>();
  for (const row of (totals ?? []) as ReconciliationTotalRow[]) {
    totalsByKey.set(`${row.date}|${row.payment_method_id}`, row);
  }

  const dates = enumerateDates(from, to).reverse();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1" htmlFor="location">
            Location
          </label>
          <select
            id="location"
            name="location"
            defaultValue={location}
            className="border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
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
        <button
          type="submit"
          className="rounded bg-foreground text-background px-3 py-1.5 text-sm"
        >
          Apply
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4">Date</th>
              {methods.map((m) => (
                <th key={m.id} className="py-2 pr-4">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => (
              <tr key={date} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4 whitespace-nowrap">{date}</td>
                {methods.map((m) => {
                  const row = totalsByKey.get(`${date}|${m.id}`);
                  const { gap, matched } = reconcile(row?.pos_total ?? 0, row?.recorded_total ?? 0);
                  const hasData = Boolean(row);
                  return (
                    <td key={m.id} className="py-1 pr-4">
                      <Link
                        href={`/transactions?date=${date}&location=${encodeURIComponent(location)}&paymentMethodId=${m.id}`}
                        className={`block rounded px-3 py-2 text-xs ${
                          !hasData
                            ? "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40"
                            : matched
                              ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
                              : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                        }`}
                      >
                        {hasData ? (matched ? "Matched" : `Gap ${formatMoney(gap)}`) : "—"}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
