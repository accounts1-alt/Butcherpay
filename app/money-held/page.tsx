import { Wallet } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdjustmentRow, EntryRow, PaymentMethodRow } from "@/lib/supabase/types";
import { effectiveNet } from "@/lib/effectiveAmount";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Money currently held</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Money taken but not yet banked, by payment method.
        </p>
      </div>

      <Card className="bg-primary text-primary-foreground border-primary">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <div className="text-sm opacity-80">Total held</div>
            <div className="text-4xl font-semibold tracking-tight mt-1">
              {formatMoney(grandTotal)}
            </div>
          </div>
          <Wallet className="h-10 w-10 opacity-70" />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing currently held — everything is banked.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {rows.map((row) => (
            <Card key={row.method.id}>
              <CardHeader className="pb-2">
                <CardTitle className="capitalize">{row.method.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardValue>{formatMoney(row.held)}</CardValue>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
