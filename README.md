# Butcherpay

Payment reconciliation app. See `CLAUDE.md` for the full product brief and
schema.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — the service role key (server-side only,
     never exposed to the browser)
2. Apply the migrations in `supabase/migrations/` to that project (via the
   Supabase CLI, `supabase db push`, or by running them through the SQL
   editor in order).
3. `npm install`
4. `npm run dev` — app runs at http://localhost:3000

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build (also type-checks)
- `npm run lint` — ESLint
- `npx vitest run` — unit tests for the shared `lib/` logic (reconciliation,
  date ranges, lifecycle, effective amounts, CSV field mapping)

## Structure

- `supabase/migrations/` — schema, in order
- `lib/` — DB types and pure/shared logic (reconciliation math, date range
  resolution, lifecycle stage progression, CSV sync mapping) — unit tested
  independently of the UI
- `app/` — one route per page: `dashboard`, `transactions` (drill-down),
  `entries/new`, `lifecycle`, `money-held`, `settings`, `connections`

All data access happens server-side (Server Components / Server Actions)
using the Supabase service role key, so no Supabase key ships to the
browser.
