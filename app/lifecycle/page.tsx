import { supabaseServer } from "@/lib/supabase/server";
import type { EntryRow, MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
import { resolveDateRange, type DateRangeKind } from "@/lib/dateRanges";
import { nextLifecycleStage } from "@/lib/lifecycle";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lifecycle</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entries grouped by date and merchant/payee, ready to advance to their next stage.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payment method</TableHead>
                <TableHead>Merchant / payee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGroups.map((group) => (
                <TableRow key={group.key}>
                  <TableCell className="whitespace-nowrap font-medium">{group.date}</TableCell>
                  <TableCell>{group.paymentMethodName}</TableCell>
                  <TableCell className="text-muted-foreground">{group.payee}</TableCell>
                  <TableCell>{formatMoney(group.amount)}</TableCell>
                  <TableCell>{formatMoney(group.fee)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(group.net)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {group.lifecycleStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {group.nextStage ? (
                      <form action={advanceLifecycleGroup}>
                        <input type="hidden" name="entry_ids" value={group.entryIds.join(",")} />
                        <input type="hidden" name="next_stage" value={group.nextStage} />
                        <Button type="submit" size="sm" variant="outline" className="capitalize">
                          Mark {group.nextStage}
                        </Button>
                      </form>
                    ) : (
                      <Badge variant="success">Complete</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sortedGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    No entries in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
