"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createEntry } from "./actions";

const TYPES_BY_DIRECTION: Record<string, { value: string; label: string }[]> = {
  in: [
    { value: "sale", label: "Sale" },
    { value: "refund_received", label: "Refund received" },
    { value: "loan_drawdown", label: "Loan drawdown" },
    { value: "owner_transfer", label: "Owner transfer" },
    { value: "other", label: "Other" },
  ],
  out: [
    { value: "bill_paid", label: "Bill paid" },
    { value: "owner_transfer", label: "Owner transfer" },
    { value: "other", label: "Other" },
  ],
};

const CASH_DENOMINATIONS = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];

function isCashMethod(name: string | undefined) {
  return (name ?? "").trim().toLowerCase() === "cash";
}

export function EntryForm({
  paymentMethods,
  merchants,
  locations,
  successBanner,
}: {
  paymentMethods: PaymentMethodRow[];
  merchants: MerchantRow[];
  locations: string[];
  successBanner: boolean;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0");
  const [denominationCounts, setDenominationCounts] = useState<Record<number, string>>({});

  const selectedMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
  const cash = isCashMethod(selectedMethod?.name);

  const availableMerchants = merchants.filter(
    (m) => m.payment_method_id === paymentMethodId && m.active
  );

  const initialStage = selectedMethod?.lifecycle_stages[0] ?? "";

  const cashTotal = useMemo(() => {
    return CASH_DENOMINATIONS.reduce((sum, denom) => {
      const qty = Number(denominationCounts[denom] ?? 0);
      return sum + (Number.isFinite(qty) ? qty * denom : 0);
    }, 0);
  }, [denominationCounts]);

  function handleMerchantChange(id: string) {
    setMerchantId(id);
    const merchant = merchants.find((m) => m.id === id);
    const amountNum = Number(amount) || 0;
    if (!merchant || merchant.fee_type === "none") {
      setFee("0");
      return;
    }
    if (merchant.fee_type === "percent") {
      setFee(((amountNum * merchant.fee_value) / 100).toFixed(2));
    } else {
      setFee(merchant.fee_value.toFixed(2));
    }
  }

  const effectiveAmount = cash ? cashTotal.toFixed(2) : amount;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add an entry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record money moving in or out of the business.
        </p>
      </div>

      {successBanner && (
        <div className="flex items-center gap-2 rounded-lg bg-success/15 text-success px-3 py-2.5 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" /> Entry added.
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <form action={createEntry} className="space-y-5">
            <input type="hidden" name="amount" value={effectiveAmount} />
            <input type="hidden" name="fee" value={cash ? "0" : fee} />
            <input type="hidden" name="lifecycle_status" value={initialStage} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  required
                  list="location-options"
                  defaultValue={locations[0] ?? ""}
                />
                <datalist id="location-options">
                  {locations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Direction</Label>
                <div className="flex gap-1 rounded-md border border-input p-1 mt-1">
                  {(["in", "out"] as const).map((d) => (
                    <label
                      key={d}
                      className={cn(
                        "flex-1 text-center rounded px-2 py-1 text-sm cursor-pointer transition-colors",
                        direction === d
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <input
                        type="radio"
                        name="direction"
                        value={d}
                        checked={direction === d}
                        onChange={() => setDirection(d)}
                        className="sr-only"
                      />
                      {d === "in" ? "Money in" : "Money out"}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" required>
                  {TYPES_BY_DIRECTION[direction].map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="payment_method_id">Payment method</Label>
              <Select
                id="payment_method_id"
                name="payment_method_id"
                required
                value={paymentMethodId}
                onChange={(e) => {
                  setPaymentMethodId(e.target.value);
                  setMerchantId("");
                  setFee("0");
                }}
              >
                {paymentMethods
                  .filter((pm) => pm.active)
                  .map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
              </Select>
            </div>

            {availableMerchants.length > 0 && (
              <div>
                <Label htmlFor="merchant_id">Merchant</Label>
                <Select
                  id="merchant_id"
                  name="merchant_id"
                  value={merchantId}
                  onChange={(e) => handleMerchantChange(e.target.value)}
                >
                  <option value="">—</option>
                  {availableMerchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {cash ? (
              <div>
                <Label>Cash denomination count</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {CASH_DENOMINATIONS.map((denom) => (
                    <div key={denom}>
                      <label className="block text-[11px] mb-0.5 text-muted-foreground">
                        {denom >= 1 ? `£${denom}` : `${denom * 100}p`}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={denominationCounts[denom] ?? ""}
                        onChange={(e) =>
                          setDenominationCounts((prev) => ({ ...prev, [denom]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm rounded-md bg-muted/60 px-3 py-2">
                  Total: <span className="font-semibold">£{cashTotal.toFixed(2)}</span>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount-input">Amount</Label>
                  <Input
                    id="amount-input"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (merchantId) handleMerchantChange(merchantId);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="fee-input">Fee</Label>
                  <Input
                    id="fee-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>

            <Button type="submit" size="lg" className="w-full">
              Add entry
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
