import { supabaseServer } from "@/lib/supabase/server";
import type { MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
import {
  createMerchant,
  createPaymentMethod,
  setMerchantActive,
  setPaymentMethodActive,
} from "./actions";

export const dynamic = "force-dynamic";

async function loadData() {
  const supabase = supabaseServer();

  const [{ data: paymentMethods, error: pmError }, { data: merchants, error: merchError }] =
    await Promise.all([
      supabase.from("payment_methods").select("*").order("name"),
      supabase.from("merchants").select("*").order("name"),
    ]);

  if (pmError) throw new Error(pmError.message);
  if (merchError) throw new Error(merchError.message);

  return {
    paymentMethods: (paymentMethods ?? []) as PaymentMethodRow[],
    merchants: (merchants ?? []) as MerchantRow[],
  };
}

export default async function SettingsPage() {
  const { paymentMethods, merchants } = await loadData();

  return (
    <div className="max-w-4xl space-y-12">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-lg font-medium mb-3">Payment methods</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-2">Name</th>
              <th className="py-2">Lifecycle stages</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paymentMethods.map((pm) => (
              <tr key={pm.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2">{pm.name}</td>
                <td className="py-2">{pm.lifecycle_stages.join(" -> ")}</td>
                <td className="py-2">{pm.active ? "Active" : "Retired"}</td>
                <td className="py-2 text-right">
                  <form action={setPaymentMethodActive.bind(null, pm.id, !pm.active)}>
                    <button className="text-xs underline" type="submit">
                      {pm.active ? "Retire" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {paymentMethods.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-black/50 dark:text-white/50">
                  No payment methods yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form action={createPaymentMethod} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs mb-1" htmlFor="pm-name">
              Name
            </label>
            <input
              id="pm-name"
              name="name"
              required
              placeholder="e.g. cheque"
              className="border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="pm-stages">
              Lifecycle stages (comma separated)
            </label>
            <input
              id="pm-stages"
              name="lifecycle_stages"
              required
              placeholder="taken, posted, banked"
              className="border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent w-72"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-foreground text-background px-3 py-1.5 text-sm"
          >
            Add payment method
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Merchants</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-2">Name</th>
              <th className="py-2">Payment method</th>
              <th className="py-2">Fee</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => {
              const pm = paymentMethods.find((p) => p.id === m.payment_method_id);
              return (
                <tr key={m.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">{m.name}</td>
                  <td className="py-2">{pm?.name ?? "—"}</td>
                  <td className="py-2">
                    {m.fee_type === "none"
                      ? "None"
                      : m.fee_type === "percent"
                        ? `${m.fee_value}%`
                        : `£${m.fee_value.toFixed(2)}`}
                  </td>
                  <td className="py-2">{m.active ? "Active" : "Retired"}</td>
                  <td className="py-2 text-right">
                    <form action={setMerchantActive.bind(null, m.id, !m.active)}>
                      <button className="text-xs underline" type="submit">
                        {m.active ? "Retire" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {merchants.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-black/50 dark:text-white/50">
                  No merchants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form action={createMerchant} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs mb-1" htmlFor="m-pm">
              Payment method
            </label>
            <select
              id="m-pm"
              name="payment_method_id"
              required
              className="border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="m-name">
              Name
            </label>
            <input
              id="m-name"
              name="name"
              required
              placeholder="e.g. Payment Sense"
              className="border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="m-fee-type">
              Fee type
            </label>
            <select
              id="m-fee-type"
              name="fee_type"
              className="border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent"
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" htmlFor="m-fee-value">
              Fee value
            </label>
            <input
              id="m-fee-value"
              name="fee_value"
              type="number"
              step="0.01"
              defaultValue={0}
              className="border rounded px-2 py-1 text-sm border-black/20 dark:border-white/20 bg-transparent w-24"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-foreground text-background px-3 py-1.5 text-sm"
          >
            Add merchant
          </button>
        </form>
      </section>
    </div>
  );
}
