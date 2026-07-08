import { CheckCircle2, TriangleAlert } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdjustmentRow, EntryRow, MerchantRow, ReconciliationTotalRow } from "@/lib/supabase/types";
import { reconcile } from "@/lib/reconciliation";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <p className="text-sm text-muted-foreground">
          Missing date, location, or payment method. Open this page from the{" "}
          <a className="underline text-primary" href="/dashboard">
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {date} · {location} · {paymentMethod?.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every entry recorded for this date, location, and payment method.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>POS total</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CardValue>{formatMoney(posTotal)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recorded total</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CardValue>{formatMoney(recordedTotal)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Gap</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <CardValue className={matched ? "text-success" : "text-destructive"}>
                {formatMoney(gap)}
              </CardValue>
              <Badge variant={matched ? "success" : "destructive"}>
                {matched ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Matched
                  </>
                ) : (
                  <>
                    <TriangleAlert className="h-3 w-3" /> Gap
                  </>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reconciles</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entryRows.map((entry) => {
                const merchant = entry.merchant_id ? merchantById.get(entry.merchant_id) : undefined;
                const entryAdjustments = adjustmentsByEntry.get(entry.id) ?? [];
                const latestAdjustment = entryAdjustments[entryAdjustments.length - 1];
                return (
                  <TableRow key={entry.id} className="align-top">
                    <TableCell className="text-muted-foreground">#{entry.reference}</TableCell>
                    <TableCell>{entry.type}</TableCell>
                    <TableCell>{merchant?.name ?? "—"}</TableCell>
                    <TableCell>
                      {formatMoney(entry.amount)}
                      {latestAdjustment && (
                        <span className="block text-xs text-muted-foreground">
                          corrected to {formatMoney(latestAdjustment.corrected_amount)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatMoney(entry.fee)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(entry.net)}</TableCell>
                    <TableCell className="capitalize">{entry.lifecycle_status}</TableCell>
                    <TableCell>
                      <Badge variant={entry.reconciles_against_pos ? "secondary" : "muted"}>
                        {entry.reconciles_against_pos ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-xs text-primary underline underline-offset-2">
                          Adjust
                        </summary>
                        <form action={createAdjustment} className="mt-2 flex flex-col gap-2 w-56">
                          <input type="hidden" name="entry_id" value={entry.id} />
                          <input type="hidden" name="original_amount" value={entry.amount} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <label className="text-xs text-muted-foreground">
                            Corrected amount
                            <Input
                              name="corrected_amount"
                              type="number"
                              step="0.01"
                              required
                              defaultValue={entry.amount}
                              className="mt-0.5"
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            Reason
                            <Input name="reason" required className="mt-0.5" />
                          </label>
                          <Button type="submit" size="sm">
                            Save adjustment
                          </Button>
                        </form>
                        {entryAdjustments.length > 0 && (
                          <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                            {entryAdjustments.map((adj) => (
                              <li key={adj.id}>
                                {formatMoney(adj.original_amount)} → {formatMoney(adj.corrected_amount)}: {adj.reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </TableCell>
                  </TableRow>
                );
              })}
              {entryRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No entries recorded for this date, location, and payment method.
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
