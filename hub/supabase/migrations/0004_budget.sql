-- 0004_budget.sql — Module 10 Budget Tracker: the multi-owner + audit ledger.
-- ADDITIVE ONLY. Touches no backbone table shape. The backbone (0001) already owns
-- the four `budget_workstream` aggregate rows (recommended/planned/committed/actual)
-- that reconcile to $365,000. This migration adds the append-only DETAIL ledger the
-- PRD needs but the aggregate table cannot express:
--   - per-owner attribution (each function owner enters their OWN spend)
--   - an audit trail (who entered what, when — immutable)
--   - a survivorship discriminator (`origin`) so campaign roll-ins (e.g. the GT
--     Challenge's gifted_quiz spend) are counted EXACTLY ONCE and never re-typed.
--
-- Aggregates are DERIVED from this ledger:
--   committed(ws) = sum(budget_entry.amount) where kind='committed'
--   actual(ws)    = sum(budget_entry.amount) where kind='actual'
-- Corrections are NEW rows (append-only); rows are never edited in place. The grants
-- enforce that: app_rw may SELECT + INSERT budget_entry, never UPDATE/DELETE.

begin;

create table if not exists budget_entry (
  id             uuid primary key default gen_random_uuid(),
  workstream_key text not null references budget_workstream(key),
  kind           text not null,                 -- committed | actual
  origin         text not null default 'manual',-- manual | campaign
  amount         numeric(12,2) not null,
  entered_by     text not null,                 -- role/user — audit trail
  owner_role     text not null,                 -- function owner responsible
  note           text,
  campaign_key   text,                          -- set when origin='campaign'
  created_at     timestamptz not null default now(),
  constraint budget_entry_amount_chk check (amount > 0),
  constraint budget_entry_kind_chk check (kind in ('committed','actual')),
  constraint budget_entry_origin_chk check (origin in ('manual','campaign')),
  constraint budget_entry_campaign_chk check (
    (origin = 'campaign' and campaign_key is not null) or
    (origin = 'manual' and campaign_key is null)
  )
);

create index if not exists budget_entry_ws_idx on budget_entry (workstream_key);
create index if not exists budget_entry_created_idx on budget_entry (created_at);

create or replace function refresh_budget_workstream_totals(p_workstream_key text)
returns void
language sql
security invoker
as $$
  update budget_workstream bw set
    committed = coalesce((
      select sum(amount) from budget_entry
      where workstream_key = p_workstream_key and kind = 'committed'
    ), 0),
    actual = coalesce((
      select sum(amount) from budget_entry
      where workstream_key = p_workstream_key and kind = 'actual'
    ), 0)
  where bw.key = p_workstream_key;
$$;

create or replace function budget_entry_after_insert()
returns trigger
language plpgsql
security invoker
as $$
begin
  perform refresh_budget_workstream_totals(new.workstream_key);
  return new;
end;
$$;

drop trigger if exists budget_entry_refresh_totals on budget_entry;
create trigger budget_entry_refresh_totals
after insert on budget_entry
for each row execute function budget_entry_after_insert();

grant select, insert on budget_entry to app_rw;
grant select on budget_entry to staff_ro;
grant select, update on budget_workstream to app_rw;
grant execute on function refresh_budget_workstream_totals(text) to app_rw;
grant usage, select on all sequences in schema public to app_rw;

commit;
