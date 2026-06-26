-- 0012_field_events.sql — Module 8 Field Marketing & Events. ADDITIVE ONLY; no backbone
-- edits. field_events = GT-organized events (manual entry); the (lower(name),event_date)
-- unique guard flags duplicates instead of silently inserting. field_event_proposals →
-- the Decision Queue (one decision per proposal via decision_id). consults_booked is
-- manual/uninstrumented in v1 (consult_source defaults to 'manual_entry', never 'tracked').
-- ambassador_events are owned by Module 2 and read-only here (no write path).

begin;

create table if not exists field_events (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  type             text not null,            -- shadow_day|chess|ama|community|festival|webinar
  event_date       date not null,
  venue            text,
  region           text,
  rsvp_count       int not null default 0,
  attendance       int not null default 0,
  consults_booked  int not null default 0,   -- manual v1 — uninstrumented
  consult_source   text not null default 'manual_entry', -- honesty marker; never 'tracked' in v1
  owner            text,
  status           text not null default 'planning', -- planning|confirmed|completed|cancelled
  workstream_key   text references budget_workstream(key),
  budget           numeric(12,2) not null default 0,
  target_persona   text,
  materials        text,
  notes            text,
  follow_up_actions jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- duplicate guard: same name+date is flagged at the app layer; unique index makes it hard.
create unique index if not exists field_events_name_date_uidx on field_events (lower(name), event_date);

create table if not exists field_event_proposals (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  type               text,
  proposed_date      date,
  rationale          text,
  expected_attendance int,
  budget_ask         numeric(12,2),
  target_persona     text,
  workstream_key     text references budget_workstream(key),
  status             text not null default 'draft', -- draft|submitted|approved|rejected
  decision_id        uuid references decisions(id),  -- one-to-one; idempotency anchor
  created_by         text,
  created_at         timestamptz not null default now()
);

grant select, insert, update on field_events, field_event_proposals to app_rw;
grant select on field_events, field_event_proposals to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
