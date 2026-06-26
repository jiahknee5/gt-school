-- 0001_backbone.sql — GT Marketing Hub data backbone
-- The load-bearing artifact: program isolation (RLS + FORCE), field-directional sync authority,
-- idempotency ledgers, parity state, and the Hub-owned budget/decision state.
--
-- ISOLATION MODEL: GLOBAL tables (staff sees everyone) vs PROGRAM-SCOPED tables (RLS-protected).
-- Program-scoped reads/writes run as role `app_rw` (NOBYPASSRLS) with a per-transaction GUC:
--     SET LOCAL app.current_program = '<program uuid>';
-- Primary (portable on Supabase) path: a privileged pooled connection does
--     SET ROLE app_rw;  SET LOCAL app.current_program = '<uuid>';   -- then run the statement(s)
-- The R1 connection smoke test decides whether `app_rw` can instead log in directly via Supavisor.
-- service_role / any BYPASSRLS role is NEVER used on program-scoped paths — it bypasses RLS.

begin;

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin create type field_authority_kind as enum ('app_form','hubspot','stripe','manual','none');
exception when duplicate_object then null; end $$;
do $$ begin create type sync_direction as enum ('hs_to_app','app_to_hs','bidir_lww');
exception when duplicate_object then null; end $$;
do $$ begin create type outbox_status as enum ('pending','inflight','done','dead');
exception when duplicate_object then null; end $$;

-- ==================== GLOBAL (CRM-wide; NOT program-scoped) ====================

create table programs (
  id   uuid primary key default gen_random_uuid(),
  key  text unique not null,
  name text not null
);

create table families (                       -- = HubSpot contact (global)
  id                 uuid primary key default gen_random_uuid(),
  hubspot_contact_id text unique,
  email              text,
  phone              text,
  first_name         text,
  last_name          text,
  -- app_form-AUTHORITATIVE (Supabase app_form is source of truth)
  funnel_stage       text,
  tefa_status        text,
  income_band        text,
  grade              text,
  -- HubSpot-AUTHORITATIVE
  lifecycle_stage    text,
  lead_score         int,
  source             text,
  -- sync bookkeeping
  match_key          text,                     -- normalized email→phone→name+zip (identity resolution)
  row_version        int  not null default 1,
  app_updated_at     timestamptz not null default now(),
  hs_updated_at      timestamptz,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now()
);
create index on families (match_key);
create index on families (hubspot_contact_id);

create table children (                        -- camp seats count CHILDREN, not families
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  first_name text,
  grade      text,
  created_at timestamptz not null default now()
);
create index on children (family_id);

create table sync_identity_map (
  id          uuid primary key default gen_random_uuid(),
  local_table text not null,
  local_id    uuid not null,
  system      text not null,                   -- 'hubspot' | 'stripe' | 'community' | 'summer_site'
  external_id text not null,
  unique (system, external_id)
);

create table field_authority (                 -- THE field-directional policy (seeded below)
  entity              text not null,
  field               text not null,
  authority           field_authority_kind not null,
  direction           sync_direction not null,
  expected_unreliable boolean not null default false,
  primary key (entity, field)
);

create table sync_outbox (                      -- transactional outbox: durable app→HubSpot intent
  id              uuid primary key default gen_random_uuid(),
  aggregate_type  text not null,
  aggregate_id    uuid not null,
  target_system   text not null,
  op              text not null,
  payload         jsonb not null,
  dedupe_key      text unique not null,
  status          outbox_status not null default 'pending',
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now()
);
create index on sync_outbox (status, next_attempt_at);

create table sync_event_log (                   -- replayable inbound log + conflict audit trail
  id                uuid primary key default gen_random_uuid(),
  source_system     text not null,
  external_event_id text,
  entity            text,
  entity_id         uuid,
  change            jsonb,
  conflict          boolean not null default false,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz
);

create table processed_events (                 -- idempotency ledger, keyed (source, event_id)
  source        text not null,
  event_id      text not null,
  first_seen_at timestamptz not null default now(),
  result        jsonb,
  primary key (source, event_id)
);

create table field_state (                      -- per-field app vs hs values; powers parity + conflict
  entity          text not null,
  entity_id       uuid not null,
  field           text not null,
  app_value       text,
  hs_value        text,
  app_updated_at  timestamptz,
  hs_updated_at   timestamptz,
  in_parity       boolean not null default true,
  last_checked_at timestamptz,
  primary key (entity, entity_id, field)
);

create table parity_snapshot (                  -- parity time series (trend + banner)
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  scope       text not null default 'overall',
  overall_pct numeric(5,2) not null,
  fields      jsonb not null default '{}'::jsonb
);

create table data_quality_issue (               -- auto-detected + manual issues (CRM Ops)
  id          uuid primary key default gen_random_uuid(),
  category    text not null,                    -- utm | sync | scoring | tracking | other
  severity    text not null,                    -- low | medium | high | blocker
  entity      text,
  entity_id   uuid,
  field       text,
  description text not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table budget_workstream (                -- Hub-owned budget; reconciles to $365,000
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  recommended numeric(12,2) not null default 0,
  planned     numeric(12,2) not null default 0,
  committed   numeric(12,2) not null default 0,
  actual      numeric(12,2) not null default 0
);

create table decisions (                        -- Decision Queue (leaders-only at the app layer)
  id             uuid primary key default gen_random_uuid(),
  question       text not null,
  raised_by      text,
  workstream     text,
  recommendation text,
  budget_ask     numeric(12,2),
  due_date       date,
  priority       text not null default 'normal',
  status         text not null default 'open',  -- open | decided | in_flight
  response       text,                          -- approve | reject | need_info
  response_note  text,
  auto_flag      boolean not null default false,-- raised by a budget >10% variance
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- ==================== PROGRAM-SCOPED (RLS + FORCE) ====================

create table program_membership (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  family_id  uuid not null references families(id),
  child_id   uuid references children(id),
  status     text not null default 'active',
  source     text,                              -- which connector/source introduced it
  joined_at  timestamptz not null default now()
);
create index on program_membership (program_id);

create table enrollments (                      -- = HubSpot deal
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references programs(id),
  family_id       uuid not null references families(id),
  child_id        uuid references children(id),
  hubspot_deal_id text,
  stage           text,
  amount          numeric(12,2),
  paid            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index on enrollments (program_id);

create table payments (
  id                       uuid primary key default gen_random_uuid(),
  program_id               uuid not null references programs(id),
  family_id                uuid references families(id),
  enrollment_id            uuid references enrollments(id),
  stripe_payment_intent_id text unique not null,   -- idempotency layer 2 (the business fact)
  stripe_event_id          text,
  amount                   numeric(12,2) not null,
  status                   text not null,          -- requires_payment | succeeded | refunded | failed
  status_rank              int  not null default 0,-- monotonic guard: never regress a terminal state
  occurred_at              timestamptz,
  created_at               timestamptz not null default now()
);
create index on payments (program_id);

-- ---------- roles ----------
-- app_rw: the ONLY role that touches program-scoped tables. NOBYPASSRLS IS the guarantee.
do $$ begin create role app_rw   nologin nobypassrls;   -- used via `SET ROLE app_rw` (portable on Supabase)
exception when duplicate_object then null; end $$;
do $$ begin create role staff_ro nologin nobypassrls;   -- CRM "see everyone": GLOBAL tables only
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on program_membership, enrollments, payments to app_rw;
grant select on programs, families, children, field_authority, sync_identity_map to app_rw;
grant select, insert, update on sync_outbox, sync_event_log, processed_events, field_state to app_rw;
grant usage, select on all sequences in schema public to app_rw;

grant select on programs, families, children, budget_workstream, decisions,
                 parity_snapshot, data_quality_issue, field_state to staff_ro;

-- Allow the connection role to assume app_rw/staff_ro via SET ROLE (R1 confirms the real
-- connecting role on Supabase — adjust the grantee if the pooler connects as authenticator).
do $$ begin grant app_rw, staff_ro to postgres; exception when others then null; end $$;

-- ---------- RLS: enable + FORCE + per-program policy on the 3 scoped tables ----------
-- The policy predicate IS the database-enforced isolation guarantee. nullif(...,'') + missing_ok
-- means an unset/empty GUC yields NULL → comparison NULL → 0 rows (FAIL-CLOSED). A query's own
-- WHERE cannot widen the predicate; WITH CHECK blocks cross-program writes.
do $$
declare t text;
begin
  foreach t in array array['program_membership','enrollments','payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format($p$
      create policy prog_isolation on %I
        using      (program_id = nullif(current_setting('app.current_program', true), '')::uuid)
        with check (program_id = nullif(current_setting('app.current_program', true), '')::uuid)
    $p$, t);
  end loop;
end $$;

-- ==================== SEEDS ====================

insert into programs (key, name) values
  ('summer_camp','Summer Camp'),
  ('fall_enrollment','Fall Enrollment');

insert into budget_workstream (key, name, recommended, planned) values
  ('grassroots',        'Grassroots marketing',                 210000, 210000),
  ('thought_leadership','Thought leadership + content engine',   90000,  90000),
  ('guerrilla',         'Guerrilla / earned media bets',         40000,  40000),
  ('foundations',       'Marketing foundations + operations',    25000,  25000);
-- total recommended = $365,000

insert into field_authority (entity, field, authority, direction, expected_unreliable) values
  ('family','funnel_stage',    'app_form','app_to_hs', false),
  ('family','tefa_status',     'app_form','app_to_hs', true),   -- HubSpot value unreliable
  ('family','income_band',     'app_form','app_to_hs', true),   -- HubSpot value unreliable
  ('family','grade',           'app_form','app_to_hs', false),
  ('family','source',          'hubspot', 'hs_to_app', true),   -- UTM/source unreliable
  ('family','lead_score',      'hubspot', 'hs_to_app', false),
  ('family','lifecycle_stage', 'hubspot', 'hs_to_app', false),
  ('family','email',           'app_form','bidir_lww', false),
  ('family','phone',           'none',    'bidir_lww', false);

commit;
