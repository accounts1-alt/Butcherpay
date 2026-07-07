"use client";

import { useMemo, useState } from "react";
import type { MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
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
      <h1 className="text-2xl font-semibold">Add an entry</h1>

      {successBanner && (
        <div className="rounded bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 px-3 py-2 text-sm">
          Entry added.
        </div>
      )}

      <form action={createEntry} className="space-y-4">
        <input type="hidden" name="amount" value={effectiveAmount} />
        <input type="hidden" name="fee" value={cash ? "0" : fee} />
        <input type="hidden" name="lifecycle_status" value={initialStage} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              name="location"
              required
              list="location-options"
              defaultValue={locations[0] ?? ""}
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
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
            <label className="block text-xs mb-1">Direction</label>
            <div className="flex gap-4 py-1.5">
              {(["in", "out"] as const).map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="direction"
                    value={d}
                    checked={direction === d}
                    onChange={() => setDirection(d)}
                  />
                  {d === "in" ? "Money in" : "Money out"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              name="type"
              required
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
            >
              {TYPES_BY_DIRECTION[direction].map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1" htmlFor="payment_method_id">
            Payment method
          </label>
          <select
            id="payment_method_id"
            name="payment_method_id"
            required
            value={paymentMethodId}
            onChange={(e) => {
              setPaymentMethodId(e.target.value);
              setMerchantId("");
              setFee("0");
            }}
            className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
          >
            {paymentMethods
              .filter((pm) => pm.active)
              .map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
          </select>
        </div>

        {availableMerchants.length > 0 && (
          <div>
            <label className="block text-xs mb-1" htmlFor="merchant_id">
              Merchant
            </label>
            <select
              id="merchant_id"
              name="merchant_id"
              value={merchantId}
              onChange={(e) => handleMerchantChange(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
            >
              <option value="">—</option>
              {availableMerchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {cash ? (
          <div>
            <label className="block text-xs mb-2">Cash denomination count</label>
            <div className="grid grid-cols-4 gap-2">
              {CASH_DENOMINATIONS.map((denom) => (
                <div key={denom}>
                  <label className="block text-[11px] mb-0.5 text-black/60 dark:text-white/60">
                    {denom >= 1 ? `£${denom}` : `${denom * 100}p`}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={denominationCounts[denom] ?? ""}
                    onChange={(e) =>
                      setDenominationCounts((prev) => ({ ...prev, [denom]: e.target.value }))
                    }
                    className="w-full border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm">
              Total: <span className="font-medium">£{cashTotal.toFixed(2)}</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" htmlFor="amount-input">
                Amount
              </label>
              <input
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
                className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs mb-1" htmlFor="fee-input">
                Fee
              </label>
              <input
                id="fee-input"
                type="number"
                min={0}
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs mb-1" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="w-full border rounded px-2 py-1.5 text-sm border-black/20 dark:border-white/20 bg-transparent"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          Add entry
        </button>
      </form>
    </div>
  );
}
