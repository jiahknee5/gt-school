-- 0007_nurture.sql — Module 5 Nurture & Lifecycle: additive tables for the engagement
-- centre. ADDITIVE ONLY; no backbone column is added to families/enrollments. The Hub
-- machinery tables are app-writable; the HubSpot-mirror stand-ins are read-only. SMS
-- carries PII (responder_phone / body) gated at the APP layer to Admin/Leader — staff_ro
-- never selects the raw PII columns.

begin;

-- engagement signals (HubSpot) → drive the engagement tier (clicked>opened>cold)
create table if not exists hs_engagement (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id),
  hs_contact_id text,
  email_send_id text,
  opened       boolean not null default false,
  clicked      boolean not null default false,
  unsubscribed boolean not null default false,
  sent_at      timestamptz
);
create index if not exists hs_engagement_family_idx on hs_engagement (family_id);

-- read-only sequence mirror (no Hub write path)
create table if not exists sequence (
  seq_id        text primary key,
  name          text not null,
  type          text not null,            -- welcome|nurture|re-engagement|event|waitlist
  audience_size integer not null default 0,
  step_count    integer not null default 0,
  status        text not null default 'active'
);
create table if not exists sequence_step_stat (
  id          uuid primary key default gen_random_uuid(),
  seq_id      text not null references sequence(seq_id),
  step_no     integer not null,
  sends       integer not null default 0,
  opens       integer not null default 0,
  clicks      integer not null default 0,
  conversions integer not null default 0
);

-- SMS inbox (HubSpot Conversations / GT Anywhere) — PII columns, app-gated
create table if not exists sms_thread (
  thread_id       text primary key,
  family_id       uuid references families(id),
  responder_phone text,                   -- PII (app-gated to Admin/Leader)
  last_message_at timestamptz,
  unread          boolean not null default false,
  status          text not null default 'open',
  opted_out       boolean not null default false  -- STOP → suppress quick-reply
);
create table if not exists sms_message (
  id         uuid primary key default gen_random_uuid(),
  thread_id  text not null references sms_thread(thread_id),
  direction  text not null,               -- in|out
  body       text,                         -- PII (app-gated to Admin/Leader)
  sent_at    timestamptz,
  theme_tags text[] not null default array['untagged']
);

-- Hub machinery: segments + SLA + the idempotent hot-family cross-link
create table if not exists nurture_segment (
  id                 uuid primary key default gen_random_uuid(),
  key                text unique not null,
  tier               text not null,        -- T1|T2|T3|custom
  name               text not null,
  rule               jsonb,
  is_tefa_historical boolean not null default false,
  frozen_at          timestamptz
);
create table if not exists sla_followup (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families(id),
  funnel_entered_at timestamptz not null,
  first_contact_at  timestamptz,
  owner             text not null,
  within_24h        boolean
);
create table if not exists family_flag (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id),
  kind          text not null,            -- hot_family
  reason        text,
  source_module text not null default 'nurture',
  dedupe_key    text unique not null,     -- idempotent cross-link emit
  created_by    text,
  created_at    timestamptz not null default now()
);

grant select, insert, update on nurture_segment, sla_followup, family_flag to app_rw;
grant select, insert, update on hs_engagement to app_rw;
grant select on sequence, sequence_step_stat to app_rw;
grant select, insert, update on sms_thread, sms_message to app_rw;
-- staff_ro: everything EXCEPT the SMS PII columns (enforced via column grants).
grant select on nurture_segment, sla_followup, family_flag, hs_engagement, sequence, sequence_step_stat to staff_ro;
grant select (thread_id, family_id, last_message_at, unread, status, opted_out) on sms_thread to staff_ro;
grant select (id, thread_id, direction, sent_at, theme_tags) on sms_message to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
