"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ConnType = "csv" | "rest_api" | "postgres" | "webhook";

const FIELD_MAPPING_HINT: Record<string, string> = {
  csv: "Column names exactly as they appear in the CSV header row.",
  postgres: "Column names your query's SELECT returns.",
};

export type ConnectionFormInitial = {
  connectionId?: string;
  name?: string;
  type?: ConnType;
  location?: string;
  query?: string;
  date_col?: string;
  location_col?: string;
  method_col?: string;
  total_col?: string;
  hasSecretKey?: boolean;
  hasConnectionString?: boolean;
  hasCaCertificate?: boolean;
};

export function ConnectionForm({
  action,
  submitLabel,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  initial?: ConnectionFormInitial;
}) {
  const [type, setType] = useState<ConnType>(initial?.type ?? "csv");
  const isEdit = Boolean(initial?.connectionId);

  return (
    <form action={action} className="flex flex-col gap-4">
      {initial?.connectionId && (
        <input type="hidden" name="connection_id" value={initial.connectionId} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="conn-name">Name</Label>
          <Input
            id="conn-name"
            name="name"
            required
            placeholder="e.g. Stripe"
            defaultValue={initial?.name}
          />
        </div>
        <div>
          <Label htmlFor="conn-type">Type</Label>
          <Select
            id="conn-type"
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value as ConnType)}
          >
            <option value="csv">CSV upload (manual)</option>
            <option value="rest_api">Stripe (API, automated)</option>
            <option value="postgres">Postgres (automated — e.g. POS via Skyvia)</option>
            <option value="webhook">Webhook (recorded only, no sync yet)</option>
          </Select>
        </div>
      </div>

      {type === "rest_api" && (
        <div className="rounded-lg bg-muted/40 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Use a <strong>restricted, read-only</strong> API key (Stripe Dashboard → Developers →
            API keys → Create restricted key, with read access to Balance Transactions only).
          </p>
          <div>
            <Label htmlFor="secret_key">
              Stripe API key{isEdit && initial?.hasSecretKey ? " (leave blank to keep current)" : ""}
            </Label>
            <Input
              id="secret_key"
              name="secret_key"
              type="password"
              required={!isEdit}
              placeholder={isEdit && initial?.hasSecretKey ? "••••••••" : "rk_live_..."}
            />
          </div>
          <div>
            <Label htmlFor="rest-location">Location to attribute these sales to</Label>
            <Input
              id="rest-location"
              name="location"
              required
              placeholder="e.g. Shop"
              defaultValue={initial?.location}
            />
          </div>
        </div>
      )}

      {type === "postgres" && (
        <div className="rounded-lg bg-muted/40 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Reads from any external Postgres database — e.g. a POS table an ETL tool like Skyvia
            keeps in sync. The query must accept the target date as its only parameter (
            <code>$1</code>) and return columns matching the mapping below.
          </p>
          <div>
            <Label htmlFor="connection_string">
              Connection string
              {isEdit && initial?.hasConnectionString ? " (leave blank to keep current)" : ""}
            </Label>
            <Input
              id="connection_string"
              name="connection_string"
              type="password"
              required={!isEdit}
              placeholder={
                isEdit && initial?.hasConnectionString
                  ? "••••••••"
                  : "postgres://user:pass@host:5432/db?sslmode=require"
              }
            />
          </div>
          <div>
            <Label htmlFor="query">Query</Label>
            <Input
              id="query"
              name="query"
              required
              placeholder="select till_date, site, tender_type, amount from pos_totals where till_date = $1"
              className="font-mono"
              defaultValue={initial?.query}
            />
          </div>
          <div>
            <Label htmlFor="ca_certificate">
              CA certificate (optional — fixes &quot;self-signed certificate in certificate
              chain&quot; on Supabase poolers)
              {isEdit && initial?.hasCaCertificate ? ", leave blank to keep current" : ""}
            </Label>
            <Textarea
              id="ca_certificate"
              name="ca_certificate"
              rows={3}
              className="font-mono text-xs"
              placeholder={
                isEdit && initial?.hasCaCertificate
                  ? "•••••••• (already set)"
                  : "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              From that database&apos;s Supabase project: Database Settings → SSL Configuration →
              download the CA certificate, then paste its contents here.
            </p>
          </div>
        </div>
      )}

      {(type === "csv" || type === "postgres") && (
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="date_col">Date column</Label>
            <Input id="date_col" name="date_col" required placeholder="Date" defaultValue={initial?.date_col} />
          </div>
          <div>
            <Label htmlFor="location_col">Location column</Label>
            <Input
              id="location_col"
              name="location_col"
              required
              placeholder="Location"
              defaultValue={initial?.location_col}
            />
          </div>
          <div>
            <Label htmlFor="method_col">Payment method column</Label>
            <Input
              id="method_col"
              name="method_col"
              required
              placeholder="Method"
              defaultValue={initial?.method_col}
            />
          </div>
          <div>
            <Label htmlFor="total_col">Total column</Label>
            <Input
              id="total_col"
              name="total_col"
              required
              placeholder="Total"
              defaultValue={initial?.total_col}
            />
          </div>
          <p className="col-span-4 text-xs text-muted-foreground -mt-1">
            {FIELD_MAPPING_HINT[type]}
          </p>
        </div>
      )}

      {type === "webhook" && (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-4">
          Recorded for tracking only — there&apos;s no automated sync for webhooks yet.
        </p>
      )}

      {(type === "rest_api" || type === "postgres") && (
        <p className="text-xs text-muted-foreground">
          Synced automatically once a day for the previous day — no schedule to set.
        </p>
      )}

      <Button type="submit" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
