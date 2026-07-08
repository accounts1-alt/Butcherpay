import Link from "next/link";
import { Check, TriangleAlert } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { PaymentMethodRow, ReconciliationTotalRow } from "@/lib/supabase/types";
import { listKnownLocations } from "@/lib/locations";
import { resolveDateRange, type DateRangeKind } from "@/lib/dateRanges";
import { reconcile } from "@/lib/reconciliation";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daily totals per payment method vs. the POS system.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="location">Location</Label>
              <Select id="location" name="location" defaultValue={location} className="w-32">
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="range">Range</Label>
              <Select id="range" name="range" defaultValue={rangeKind} className="w-36">
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={from} className="w-40" />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={to} className="w-40" />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Date
                </th>
                {methods.map((m) => (
                  <th
                    key={m.id}
                    className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => (
                <tr key={date} className="border-b border-border/60 last:border-0">
                  <td className="py-2 px-4 whitespace-nowrap font-medium">{date}</td>
                  {methods.map((m) => {
                    const row = totalsByKey.get(`${date}|${m.id}`);
                    const { gap, matched } = reconcile(row?.pos_total ?? 0, row?.recorded_total ?? 0);
                    const hasData = Boolean(row);
                    return (
                      <td key={m.id} className="py-1.5 px-4">
                        <Link
                          href={`/transactions?date=${date}&location=${encodeURIComponent(location)}&paymentMethodId=${m.id}`}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            !hasData
                              ? "bg-muted text-muted-foreground"
                              : matched
                                ? "bg-success/15 text-success hover:bg-success/25"
                                : "bg-destructive/15 text-destructive hover:bg-destructive/25"
                          )}
                        >
                          {hasData ? (
                            matched ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Matched
                              </>
                            ) : (
                              <>
                                <TriangleAlert className="h-3.5 w-3.5" /> {formatMoney(gap)}
                              </>
                            )
                          ) : (
                            "—"
                          )}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
