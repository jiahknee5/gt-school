-- 0006_dashboard.sql — Module 6 Dashboard / KPI Tracking: the read-only aggregator's
-- own tables. ADDITIVE ONLY. The dashboard owns NO funnel/pipeline/payment data; it
-- reads each home module's source of truth via the single KPI registry
-- (lib/metrics/registry.ts) and writes ONLY these five machinery tables:
--   - kpi_definition      the semantic layer: ONE definition per KPI (kills drift)
--   - scorecard_snapshot  the canonical scorecard, versioned + immutable per week
--   - kpi_goal            leadership-editable targets (Leader-only; logged)
--   - kpi_goal_audit      append-only change log (who + before/after)
--   - connector_sync_status  per-connector last-sync (data freshness / stale badge)

begin;

create table if not exists kpi_definition (
  key          text primary key,
  label        text not null,
  home_module  text not null,            -- slug of the module that OWNS this number
  source       text not null,            -- supabase | hubspot | meta | ga4 | x | manual
  definition   text,                     -- the single formula/SQL reference
  unit         text not null,            -- count | pct | ratio | currency
  direction    text not null default 'higher_better',
  instrumented boolean not null default true,  -- false → low-confidence badge
  format       text
);

create table if not exists scorecard_snapshot (
  id          uuid primary key default gen_random_uuid(),
  week_of     date not null,             -- Monday of the week (version key)
  kpi_key     text not null references kpi_definition(key),
  this_week   numeric(14,2) not null,
  last_week   numeric(14,2),
  delta       numeric(14,2),
  sparkline   jsonb,                      -- last-4-wk series
  target      numeric(14,2),
  status      text not null default 'on_track',  -- on_track | watch | at_risk
  source      text,
  confidence  text not null default 'measured',  -- measured | low
  computed_at timestamptz not null default now(),
  constraint scorecard_snapshot_unique unique (week_of, kpi_key),
  constraint scorecard_status_chk check (status in ('on_track','watch','at_risk')),
  constraint scorecard_confidence_chk check (confidence in ('measured','low'))
);

create index if not exists scorecard_snapshot_week_idx on scorecard_snapshot (week_of);

create table if not exists kpi_goal (
  id            uuid primary key default gen_random_uuid(),
  kpi_key       text not null references kpi_definition(key),
  workstream_key text,                    -- per-workstream goals (nullable)
  period        text not null,            -- fall_2026 etc.
  target_value  numeric(14,2) not null,
  cutoff_date   date,                      -- drives required run-rate
  set_by        text not null,            -- actor (Leader)
  updated_at    timestamptz not null default now(),
  constraint kpi_goal_unique unique (kpi_key, period)
);

create table if not exists kpi_goal_audit (
  id          uuid primary key default gen_random_uuid(),
  kpi_goal_id uuid references kpi_goal(id),
  kpi_key     text,
  actor       text not null,
  old_value   numeric(14,2),
  new_value   numeric(14,2),
  changed_at  timestamptz not null default now()
);

create table if not exists connector_sync_status (
  connector             text primary key,  -- supabase | hubspot | meta | ga4 | x | manual
  last_sync_at          timestamptz,
  freshness_sla_minutes integer not null default 1440,
  status                text not null default 'fresh',  -- fresh | stale | error
  constraint connector_sync_status_chk check (status in ('fresh','stale','error'))
);

-- Grants: the dashboard machinery is app-writable for snapshots/goals/audit/freshness;
-- goal WRITES are additionally gated to Leaders in the application layer (route guard).
grant select, insert on scorecard_snapshot to app_rw;
grant select, insert, update on kpi_definition to app_rw;
grant select, insert, update on kpi_goal to app_rw;
grant select, insert on kpi_goal_audit to app_rw;
grant select, insert, update on connector_sync_status to app_rw;
grant select on scorecard_snapshot, kpi_definition, kpi_goal, kpi_goal_audit, connector_sync_status to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
