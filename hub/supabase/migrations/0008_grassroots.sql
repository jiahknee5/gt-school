-- 0008_grassroots.sql — Module 2 Grassroots Engine: additive tables. ADDITIVE ONLY; no
-- backbone edits. The golden `ambassadors` row is the survivorship output of the dual
-- feed (community_ambassadors + hubspot_ambassadors) and is UNIQUE on match_key (no
-- double-count). parent_events are owned here; Field Marketing reads them only.

begin;

create table if not exists ambassadors (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid references families(id),
  match_key        text unique not null,           -- one golden record per identity
  stage            text not null default 'Prospect',
  segment          text,
  region           text,
  owner            text,
  source_winner    text,                            -- community | hubspot | both
  status_confidence text not null default 'high',   -- low when unmapped
  last_touch_at    timestamptz
);

create table if not exists ambassador_activity (
  id            uuid primary key default gen_random_uuid(),
  ambassador_id uuid references ambassadors(id),
  type          text not null,                       -- intro | p2p_call | touch | testimonial_req
  family_id     uuid references families(id),
  dedupe_key    text unique not null,                -- ambassador×family×type×window
  occurred_at   timestamptz
);

create table if not exists market_map_nodes (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  name           text not null,
  contact        text,
  status         text not null default 'cold',       -- cold|outreach|in_conversation|active|closed
  leads_generated integer not null default 0,
  lat            numeric,
  lng            numeric,                             -- null → ungeocoded bucket
  owner          text,
  last_activity_at timestamptz
);

create table if not exists referral_sprints (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  window_start       date,
  window_end         date,
  status             text not null default 'active',  -- active | archived
  families_identified integer not null default 0,
  conversions        integer not null default 0
);
create table if not exists sprint_enlistments (
  sprint_id     uuid references referral_sprints(id),
  ambassador_id uuid references ambassadors(id),
  primary key (sprint_id, ambassador_id)
);

create table if not exists parent_events (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  host_ambassador_id    uuid references ambassadors(id),
  date                  date,
  location              text,
  type                  text,                          -- coffee_chat|qa|school_visit|virtual
  materials_requested   text,
  gt_support            text,
  rsvp_count            integer not null default 0,
  attendance            integer not null default 0,
  follow_up_families    integer not null default 0,
  conversions_influenced integer not null default 0
);

create table if not exists testimonials (
  id              uuid primary key default gen_random_uuid(),
  ambassador_id   uuid references ambassadors(id),
  clip_url        text,
  summary         text,
  content_stub_id text
);

create table if not exists hot_family_flags (
  id                      uuid primary key default gen_random_uuid(),
  family_id               uuid references families(id),
  flagged_by_ambassador_id uuid references ambassadors(id),
  reason_code             text not null,
  urgent                  boolean not null default false,
  minimized               boolean not null default true,  -- PII minimized by construction
  dedupe_key              text unique not null,
  created_at              timestamptz not null default now()
);

grant select, insert, update on ambassadors, ambassador_activity, market_map_nodes to app_rw;
grant select, insert, update on referral_sprints, sprint_enlistments, parent_events to app_rw;
grant select, insert, update on testimonials, hot_family_flags to app_rw;
grant select on ambassadors, ambassador_activity, market_map_nodes, referral_sprints,
  sprint_enlistments, parent_events, testimonials, hot_family_flags to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
