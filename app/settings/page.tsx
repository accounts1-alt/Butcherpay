import { supabaseServer } from "@/lib/supabase/server";
import type { MerchantRow, PaymentMethodRow } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage payment methods and merchants — everything else in the app reads from here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Payment methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Lifecycle stages</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentMethods.map((pm) => (
                <TableRow key={pm.id}>
                  <TableCell className="font-medium">{pm.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {pm.lifecycle_stages.join(" → ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pm.active ? "success" : "muted"}>
                      {pm.active ? "Active" : "Retired"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={setPaymentMethodActive.bind(null, pm.id, !pm.active)}>
                      <Button variant="ghost" size="sm" type="submit">
                        {pm.active ? "Retire" : "Reactivate"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {paymentMethods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No payment methods yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={createPaymentMethod} className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-4">
            <div>
              <Label htmlFor="pm-name">Name</Label>
              <Input id="pm-name" name="name" required placeholder="e.g. cheque" />
            </div>
            <div>
              <Label htmlFor="pm-stages">Lifecycle stages (comma separated)</Label>
              <Input
                id="pm-stages"
                name="lifecycle_stages"
                required
                placeholder="taken, posted, banked"
                className="w-72"
              />
            </div>
            <Button type="submit">Add payment method</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Merchants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Payment method</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchants.map((m) => {
                const pm = paymentMethods.find((p) => p.id === m.payment_method_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{pm?.name ?? "—"}</TableCell>
                    <TableCell>
                      {m.fee_type === "none"
                        ? "None"
                        : m.fee_type === "percent"
                          ? `${m.fee_value}%`
                          : `£${m.fee_value.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.active ? "success" : "muted"}>
                        {m.active ? "Active" : "Retired"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={setMerchantActive.bind(null, m.id, !m.active)}>
                        <Button variant="ghost" size="sm" type="submit">
                          {m.active ? "Retire" : "Reactivate"}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
              {merchants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No merchants yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={createMerchant} className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-4">
            <div>
              <Label htmlFor="m-pm">Payment method</Label>
              <Select id="m-pm" name="payment_method_id" required className="w-40">
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="m-name">Name</Label>
              <Input id="m-name" name="name" required placeholder="e.g. Payment Sense" />
            </div>
            <div>
              <Label htmlFor="m-fee-type">Fee type</Label>
              <Select id="m-fee-type" name="fee_type" className="w-28">
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
                <option value="none">None</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="m-fee-value">Fee value</Label>
              <Input
                id="m-fee-value"
                name="fee_value"
                type="number"
                step="0.01"
                defaultValue={0}
                className="w-24"
              />
            </div>
            <Button type="submit">Add merchant</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
