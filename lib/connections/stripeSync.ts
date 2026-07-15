import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionRow, Database } from "@/lib/supabase/types";
import { upsertPosDailyTotals } from "@/lib/posSync";

export type StripeConnectionConfig = {
  secret_key: string;
  location: string;
};

export function isStripeConnectionConfig(value: unknown): value is StripeConnectionConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.secret_key === "string" &&
    v.secret_key.length > 0 &&
    typeof v.location === "string" &&
    v.location.length > 0
  );
}

async function sumBalanceTransactions(
  stripe: Stripe,
  type: "charge" | "refund",
  gte: number,
  lt: number
): Promise<number> {
  let total = 0;
  for await (const txn of stripe.balanceTransactions.list({ type, created: { gte, lt }, limit: 100 })) {
    total += txn.amount;
  }
  return total;
}

// Sums gross card sales for one UTC day (charges minus refunds), matching what
// a POS system would report as "card takings" for that day. Stripe amounts
// come back in the account's smallest currency unit (pence for GBP) and are
// converted to pounds by dividing by 100 -- correct for 2-decimal currencies
// (GBP/USD/EUR), not for zero-decimal currencies like JPY.
export async function fetchStripeDailyTotal(secretKey: string, date: string): Promise<number> {
  const stripe = new Stripe(secretKey);
  const startOfDay = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const startOfNextDay = startOfDay + 86400;

  const [chargeTotal, refundTotal] = await Promise.all([
    sumBalanceTransactions(stripe, "charge", startOfDay, startOfNextDay),
    sumBalanceTransactions(stripe, "refund", startOfDay, startOfNextDay),
  ]);

  // Refund balance transaction amounts are already negative, so this nets out.
  return (chargeTotal + refundTotal) / 100;
}

export async function syncStripeConnection(
  supabase: SupabaseClient<Database>,
  connection: ConnectionRow,
  date: string
): Promise<{ total: number }> {
  if (!isStripeConnectionConfig(connection.config)) {
    throw new Error(
      "Stripe connection config must include a secret_key and a location"
    );
  }

  const total = await fetchStripeDailyTotal(connection.config.secret_key, date);

  const { data: cardMethod, error: pmError } = await supabase
    .from("payment_methods")
    .select("*")
    .ilike("name", "card")
    .maybeSingle();
  if (pmError) throw new Error(pmError.message);
  if (!cardMethod) {
    throw new Error("No 'card' payment method configured — add one in Settings first");
  }

  await upsertPosDailyTotals(supabase, connection.id, [
    {
      date,
      location: connection.config.location,
      paymentMethodName: cardMethod.name,
      total,
    },
  ]);

  return { total };
}
