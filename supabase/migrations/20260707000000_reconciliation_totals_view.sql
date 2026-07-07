-- Per (date, location, payment_method) sums feeding the reconciliation logic
-- in lib/reconciliation.ts. Deliberately stops at the sums: gap/matched math
-- lives only in that shared function so it's never duplicated between SQL
-- and the app.
--
-- recorded_total uses each entry's latest adjustment (corrected_amount) in
-- place of its original amount where one exists, since corrections must feed
-- forward into all calculations while entries.amount/net stay untouched as
-- the audit trail (see adjustments table).
create view reconciliation_totals as
with pos as (
  select date, location, payment_method_id, sum(total) as pos_total
  from pos_daily_totals
  group by date, location, payment_method_id
),
latest_adjustment as (
  select distinct on (entry_id)
    entry_id, corrected_amount
  from adjustments
  order by entry_id, adjusted_at desc
),
recorded as (
  select
    e.date,
    e.location,
    e.payment_method_id,
    sum(coalesce(la.corrected_amount, e.amount) - e.fee) as recorded_total
  from entries e
  left join latest_adjustment la on la.entry_id = e.id
  where e.reconciles_against_pos
  group by e.date, e.location, e.payment_method_id
)
select
  coalesce(pos.date, recorded.date) as date,
  coalesce(pos.location, recorded.location) as location,
  coalesce(pos.payment_method_id, recorded.payment_method_id) as payment_method_id,
  coalesce(pos.pos_total, 0) as pos_total,
  coalesce(recorded.recorded_total, 0) as recorded_total
from pos
full outer join recorded
  on pos.date = recorded.date
  and pos.location = recorded.location
  and pos.payment_method_id = recorded.payment_method_id;
