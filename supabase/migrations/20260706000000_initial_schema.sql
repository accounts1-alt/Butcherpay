-- Initial schema for the reconciliation app.
-- See CLAUDE.md for the full data model and business rules this encodes.

create extension if not exists pgcrypto;

-- connections: external systems this app reads from (POS, bank feeds, etc.)
create table connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('postgres', 'rest_api', 'csv', 'webhook')),
  config jsonb not null,
  field_mapping jsonb not null,
  sync_schedule text,
  last_synced_at timestamptz,
  status text not null default 'healthy' check (status in ('healthy', 'failing', 'disabled'))
);

-- payment_methods: configurable list, not hardcoded
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lifecycle_stages text[] not null,
  active boolean not null default true
);

-- merchants: sub-entities of a payment method (e.g. card processors)
create table merchants (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid references payment_methods(id) not null,
  name text not null,
  fee_type text not null default 'percent' check (fee_type in ('percent', 'fixed', 'none')),
  fee_value numeric not null default 0,
  active boolean not null default true,
  unique (payment_method_id, name)
);

create index merchants_payment_method_id_idx on merchants(payment_method_id);

-- entries: the master ledger
create table entries (
  id uuid primary key default gen_random_uuid(),
  reference bigserial,
  date date not null,
  location text not null,
  direction text not null check (direction in ('in', 'out')),
  type text not null check (
    type in ('sale', 'refund_received', 'bill_paid', 'loan_drawdown', 'owner_transfer', 'other')
  ),
  reconciles_against_pos boolean not null default false,
  payment_method_id uuid references payment_methods(id) not null,
  merchant_id uuid references merchants(id),
  amount numeric not null,
  fee numeric not null default 0,
  net numeric generated always as (amount - fee) stored,
  lifecycle_status text not null,
  posted_at timestamptz,
  banked_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index entries_date_location_method_idx on entries(date, location, payment_method_id);
create index entries_merchant_id_idx on entries(merchant_id);

-- reconciles_against_pos is derived from type, never set independently:
-- only 'sale' entries are ever compared against the POS system.
create or replace function entries_set_reconciles_against_pos()
returns trigger as $$
begin
  new.reconciles_against_pos := (new.type = 'sale');
  return new;
end;
$$ language plpgsql;

create trigger entries_set_reconciles_against_pos_trg
  before insert or update on entries
  for each row execute function entries_set_reconciles_against_pos();

-- lifecycle_status must be one of the assigned payment method's lifecycle_stages.
create or replace function entries_validate_lifecycle_status()
returns trigger as $$
declare
  allowed_stages text[];
begin
  select lifecycle_stages into allowed_stages
  from payment_methods
  where id = new.payment_method_id;

  if allowed_stages is null then
    raise exception 'payment_method % not found', new.payment_method_id;
  end if;

  if not (new.lifecycle_status = any (allowed_stages)) then
    raise exception 'lifecycle_status % is not valid for payment_method % (allowed: %)',
      new.lifecycle_status, new.payment_method_id, allowed_stages;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger entries_validate_lifecycle_status_trg
  before insert or update on entries
  for each row execute function entries_validate_lifecycle_status();

-- adjustments: corrections, never overwrite entries directly
create table adjustments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries(id) not null,
  original_amount numeric not null,
  corrected_amount numeric not null,
  reason text not null,
  adjusted_at timestamptz not null default now()
);

create index adjustments_entry_id_idx on adjustments(entry_id);

-- pos_daily_totals: synced from connections, per date/location/method.
-- Unique per (date, location, payment_method_id) so re-syncs upsert the
-- latest total rather than accumulating duplicate rows that would be
-- double-counted by the reconciliation logic.
create table pos_daily_totals (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references connections(id),
  date date not null,
  location text not null,
  payment_method_id uuid references payment_methods(id) not null,
  total numeric not null,
  synced_at timestamptz not null default now(),
  unique (date, location, payment_method_id)
);

create index pos_daily_totals_date_location_method_idx
  on pos_daily_totals(date, location, payment_method_id);
