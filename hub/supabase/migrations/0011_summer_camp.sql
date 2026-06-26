-- 0011_summer_camp.sql — Module 4 Summer Camp. ADDITIVE ONLY; touches NO backbone table.
-- camp_session = real per-campus capacity (campus cards + capacity-sold % are data, not a
-- constant). camp_registration_resolved = the dual-source golden record (one row per
-- child·session; resolved_key makes the dedupe idempotent; weeks conflict kept + flagged).
-- camp_attendance feeds the Attended funnel stage + the role-gated roster (minors' PII).
-- RLS scopes camp rows to the summer_camp program.

begin;

create table if not exists camp_session (
  id            uuid primary key default gen_random_uuid(),
  campus_key    text unique not null,        -- georgetown|austin|dallas|houston
  name          text not null,
  session_start date,
  weeks         int not null,                -- 1 or 2
  capacity      int not null,                -- 60|48|40|30
  status        text not null default 'open' -- open|waitlist|closed
);

create table if not exists camp_registration_resolved (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid references programs(id),
  resolved_key  text unique not null,        -- hash(match_key+campus_key+session_start) — idempotent
  family_id     uuid references families(id),
  child_id      uuid references children(id),
  campus_key    text references camp_session(campus_key),
  weeks         int,                          -- survivorship (site-primary on conflict)
  amount        numeric,                      -- booked = weeks × 1450 (Stripe is cash truth)
  funnel_stage  text,                         -- lead|registered|paid|attended
  source_feeds  text[],                       -- {summer_site}|{registration_form}|both
  conflict      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists camp_resolved_campus_idx on camp_registration_resolved (campus_key);

create table if not exists camp_attendance (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid references programs(id),
  registration_id uuid references camp_registration_resolved(id),
  attended        boolean not null default false,
  marked_at       timestamptz
);

-- RLS: camp rows are scoped to the summer_camp program (mirrors backbone isolation).
alter table camp_registration_resolved enable row level security;
alter table camp_attendance enable row level security;
do $$ begin
  create policy camp_resolved_scope on camp_registration_resolved
    using (program_id = current_setting('app.program_id', true)::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy camp_attendance_scope on camp_attendance
    using (program_id = current_setting('app.program_id', true)::uuid);
exception when duplicate_object then null; end $$;

grant select, insert, update on camp_session, camp_registration_resolved, camp_attendance to app_rw;
grant select on camp_session, camp_registration_resolved, camp_attendance to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
