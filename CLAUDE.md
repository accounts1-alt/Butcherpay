# Reconciliation app — project brief

## What this is

A payment reconciliation app replacing a manual Excel "Activity Book". It tracks
money coming into (and out of) a business across multiple payment methods, matches
daily totals against a POS system, tracks the lifecycle of non-instant payments
(taken -> posted -> banked), and keeps a running figure of money not yet in the bank.

## Core concepts

- **Entry**: a single record of money moving. Has a direction (in/out), a type
  (sale, refund_received, bill_paid, loan_drawdown, owner_transfer, other), a date,
  a location, a payment method, and an amount.
- **reconciles_against_pos flag**: true only for `sale` type entries. Only these are
  compared against the POS system's total. Everything else (bills paid, refunds,
  loans) still needs tracking for cash-on-hand and lifecycle purposes, but is
  excluded from the POS-matching logic.
- **Lifecycle**: non-instant payment methods (cheque, voucher) move through
  Taken -> Posted -> Banked. Cards move Taken -> Banked (no posting step). Cash and
  bacs are effectively instant (Taken = Banked). Lifecycle stages per method are
  configurable, not hardcoded (see Settings below).
- **Fee**: optional per-entry, auto-populated from the merchant/method's configured
  fee where possible (e.g. voucher 1%, card processor fee), always shown net.
- **Adjustment**: NEVER edit an existing entry's amount directly if it has already
  been reconciled. Instead create a linked adjustment record (original amount,
  corrected amount, reason, date). The corrected total feeds forward into all
  calculations; the original stays visible in history. This preserves an audit trail.

## Database schema (Postgres / Supabase)

```sql
-- connections: external systems this app reads from (POS, bank feeds, etc.)
create table connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- e.g. "Semtek POS"
  type text not null,               -- 'postgres' | 'rest_api' | 'csv' | 'webhook'
  config jsonb not null,            -- connection-specific credentials/settings
  field_mapping jsonb not null,     -- maps source fields -> internal schema fields
  sync_schedule text,               -- cron expression, null if manual/webhook
  last_synced_at timestamptz,
  status text not null default 'healthy'  -- 'healthy' | 'failing' | 'disabled'
);

-- payment_methods: configurable list, not hardcoded
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- 'cash' | 'cheque' | 'voucher' | 'card' | 'bacs' | custom
  lifecycle_stages text[] not null, -- e.g. ['taken','posted','banked'] or ['taken','banked']
  active boolean not null default true
);

-- merchants: sub-entities of a payment method (e.g. card processors)
create table merchants (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid references payment_methods(id),
  name text not null,               -- 'Payment Sense' | 'Amex' | 'Stripe'
  fee_type text not null default 'percent',  -- 'percent' | 'fixed' | 'none'
  fee_value numeric not null default 0,
  active boolean not null default true
);

-- entries: the master ledger
create table entries (
  id uuid primary key default gen_random_uuid(),
  reference bigserial,               -- sequential, human-readable
  date date not null,
  location text not null,            -- 'Shop' | 'Unit' | configurable
  direction text not null,           -- 'in' | 'out'
  type text not null,                -- 'sale' | 'refund_received' | 'bill_paid' | 'loan_drawdown' | 'owner_transfer' | 'other'
  reconciles_against_pos boolean not null default false,
  payment_method_id uuid references payment_methods(id),
  merchant_id uuid references merchants(id),  -- nullable, only for methods with merchants
  amount numeric not null,
  fee numeric not null default 0,
  net numeric generated always as (amount - fee) stored,
  lifecycle_status text not null,    -- must be one of payment_method's lifecycle_stages
  posted_at timestamptz,
  banked_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- adjustments: corrections, never overwrite entries directly
create table adjustments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries(id) not null,
  original_amount numeric not null,
  corrected_amount numeric not null,
  reason text not null,
  adjusted_at timestamptz not null default now()
);

-- pos_daily_totals: synced from connections, per date/location/method
create table pos_daily_totals (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references connections(id),
  date date not null,
  location text not null,
  payment_method_id uuid references payment_methods(id),
  total numeric not null,
  synced_at timestamptz not null default now()
);
```

## Reconciliation logic (build as a DB view or pure function, not inline in UI)

For each (date, location, payment_method):
```
pos_total = sum(pos_daily_totals.total where reconciles_against_pos context matches)
recorded_total = sum(entries.net where reconciles_against_pos = true
                      and date/location/payment_method match)
gap = pos_total - recorded_total
matched = (gap == 0)
```
This must be testable in isolation, independent of any UI, before wiring it to the
dashboard.

## Pages

1. **Dashboard** — date range picker (today / this week / this month / custom).
   Day-by-day table, one column per payment method. Each cell itself is colored
   green (matched) or red (gap) — no separate status column. Clicking a cell opens
   Transaction detail for that date + method.
2. **Transaction detail** — drill-down showing every individual entry for a given
   date + payment method, POS total vs recorded vs gap, with an "Adjust" action on
   any row.
3. **Add an entry** — single form: date, location, direction (in/out), type
   (narrows based on direction), payment method selector (switches fields below:
   cash denomination grid, or amount/fee for cheque/voucher/bacs), card entries
   auto-imported from connections where possible.
4. **Lifecycle** — rows grouped by date + merchant/payee (not per instrument).
   Shows amount, fee, net, and lifecycle status with the ability to advance status
   (mark Posted, mark Banked).
5. **Money currently held** — running total of everything taken but not yet banked,
   broken down by payment method.
6. **Settings** — manage payment_methods and merchants: add/retire, set fee,
   define lifecycle_stages. This is what lets the app adapt to a new merchant or
   fee change without a code change.
7. **Connections** — manage external data sources: type, credentials, field
   mapping (source field -> internal schema field), sync schedule, sync status.

## Build order

1. Schema + migrations (above), no UI yet.
2. Settings page (payment_methods, merchants) — everything else reads from this.
3. Add an entry page — get real data flowing in.
4. Reconciliation logic as an isolated, tested function/view.
5. Dashboard -> Transaction detail -> Lifecycle -> Money held, in that order.
6. Connections page + first real sync (e.g. Semtek via Supabase) last — highest
   risk, easiest to build against seeded data first.
7. Parallel-run against the existing spreadsheet for at least two weeks before
   cutover.

## Conventions

- Never edit a reconciled entry's amount in place — use the adjustments table.
- All money math (totals, gaps, fees) computed in SQL/views or a shared library
  function, never duplicated inline in multiple UI components.
- Every new payment method or merchant must be addable via the Settings page
  without a deploy.
