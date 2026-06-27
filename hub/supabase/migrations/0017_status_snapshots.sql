-- 0017_status_snapshots.sql — pre-loaded weekly executive Status verdicts.
-- ADDITIVE: a new global table for the Status page's generated snapshots. It touches no
-- backbone column and no program-scoped table. `program` is a logical key column (like
-- kpi_goal's period), not the RLS program scope; reads/writes go through the app_rw path
-- with NO program GUC set (lib/db withoutProgram), matching kpi_goal / home_layout.
--
-- One row per (program, week_start): the verdict the board showed THAT week. The cron
-- (app/api/cron/status-refresh) upserts the current week every Monday ~07:00; the admin
-- "regenerate now" trigger upserts on demand. Historical weeks are recalled, never
-- recomputed. If no RW DB is provisioned (the demo default), the app falls back to a
-- file/seed store + on-view deterministic generation — see lib/status/store.ts.

begin;

create table if not exists status_snapshot (
  id           uuid primary key default gen_random_uuid(),
  program      text not null,                 -- fall_enrollment | summer_camp | all
  week_start   date not null,                 -- the reporting-week Monday (registry weekMondays)
  generated_at timestamptz not null default now(),
  source       text not null default 'deterministic'
               check (source in ('llm', 'deterministic')),
  model        text not null default 'deterministic-rubric-v1',
  inputs_hash  text not null,                 -- hash of the grounding numbers (stale detection)
  content      jsonb not null,                -- the rubric-structured Answer + per-stage narrative
  updated_at   timestamptz not null default now(),
  unique (program, week_start)
);

create index if not exists status_snapshot_program_week_idx
  on status_snapshot (program, week_start);

-- App writes (cron + admin regenerate) and reads through app_rw. Upsert needs update.
grant select, insert, update on status_snapshot to app_rw;

commit;
