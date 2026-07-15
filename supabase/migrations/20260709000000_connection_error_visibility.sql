-- Surface why a connection sync failed without needing platform logs.
alter table connections add column last_error text;

-- Deleting a connection should not fail (or cascade-delete historical POS
-- totals) just because pos_daily_totals rows reference it -- the totals
-- themselves stay valid audit history even if the connection config that
-- produced them is later removed. Looked up by column rather than a
-- hardcoded constraint name since Postgres's auto-generated name isn't
-- guaranteed.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
  where tc.table_name = 'pos_daily_totals'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'connection_id';

  if fk_name is not null then
    execute format('alter table pos_daily_totals drop constraint %I', fk_name);
  end if;

  alter table pos_daily_totals
    add constraint pos_daily_totals_connection_id_fkey
    foreign key (connection_id) references connections(id) on delete set null;
end $$;
