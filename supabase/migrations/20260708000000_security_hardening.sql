-- This app only ever talks to Postgres via the service_role key from
-- trusted server-side code (Server Components/Actions) — no client ever
-- uses the anon/authenticated PostgREST roles. Enabling RLS with no
-- policies denies those roles by default while service_role (which
-- bypasses RLS) continues to work unaffected.
alter table connections enable row level security;
alter table payment_methods enable row level security;
alter table merchants enable row level security;
alter table entries enable row level security;
alter table adjustments enable row level security;
alter table pos_daily_totals enable row level security;

-- Pin search_path so these SECURITY INVOKER trigger functions can't be
-- redirected by a caller-controlled search_path.
alter function entries_set_reconciles_against_pos() set search_path = public, pg_temp;
alter function entries_validate_lifecycle_status() set search_path = public, pg_temp;

-- Views default to running with the creator's privileges (bypassing the
-- querying role's RLS). security_invoker makes this view respect the
-- querying role's own RLS instead.
alter view reconciliation_totals set (security_invoker = true);
