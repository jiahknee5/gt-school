-- GT Marketing Hub — Phase 1 backbone schema
-- Idempotent (safe to re-run). Apply with:  psql "$SUPABASE_DB_URL" -f db/01_schema.sql
--
-- Design:
--   public  → shared CRM-mirror + sync plumbing (the team sees everyone here)
--   fall    → program-isolated Fall (GT Anywhere) enrollment store
--   summer  → program-isolated Summer Camp registration store
-- Isolation is enforced by Postgres ROLES + GRANTS (DB-level, provable), not app code:
-- role gt_fall can touch only schema fall; gt_summer only schema summer. Cross-access = permission denied.

create schema if not exists fall;
create schema if not exists summer;

-- ───────────────────────── shared: app_form ─────────────────────────
-- SOURCE OF TRUTH for funnel / TEFA / income / grade (spec: NOT HubSpot field values).
create table if not exists public.app_form (
  ext_id              text primary key,          -- matches HubSpot gt_ext_id
  email               text unique not null,
  parent_first        text,
  parent_last         text,
  child_first         text,
  child_grade         text,
  grade_band          text,
  income_band         text,                       -- TRUE value; HubSpot's copy is unreliable
  geo                 text,
  state               text,
  persona             text,
  tier                text,
  engagement_tier     text,
  utm_source          text,
  follows_alpha_on_x  text,
  esa_status          text,
  lead_score          int,
  program_interest    text,
  hubspot_contact_id  text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ───────────────────────── sync plumbing ─────────────────────────
create table if not exists public.sync_cursor (
  key          text primary key,                  -- e.g. 'hubspot:contacts'
  last_synced  timestamptz,
  updated_at   timestamptz default now()
);

-- idempotency ledger: a webhook event is processed at most once (Stripe + HubSpot)
create table if not exists public.webhook_events (
  id            text primary key,                 -- provider event id
  source        text not null,                    -- 'stripe' | 'hubspot'
  type          text,
  payload       jsonb,
  received_at   timestamptz default now(),
  processed_at  timestamptz,
  status        text default 'received'           -- received | processed | duplicate | error
);

-- per-field parity results → drives the CRM Ops data-confidence banner
create table if not exists public.sync_parity (
  id              bigserial primary key,
  object_type     text,
  ext_id          text,
  field           text,
  supabase_value  text,
  hubspot_value   text,
  in_sync         boolean,
  checked_at      timestamptz default now()
);
create index if not exists sync_parity_ext_idx on public.sync_parity (ext_id);

-- ───────────────────────── program-isolated: FALL ─────────────────────────
create table if not exists fall.enrollments (
  id                    bigserial primary key,
  ext_id                text,                       -- HubSpot deal gt_ext_id (join key)
  app_form_ext_id       text references public.app_form (ext_id),
  hubspot_deal_id       text,
  stage                 text,                       -- lead | applicant | shadow_day | deposit
  amount_cents          int,
  esa_covered           text,
  stripe_payment_intent text,
  paid_at               timestamptz,
  created_at            timestamptz default now()
);

-- ───────────────────────── program-isolated: SUMMER ─────────────────────────
create table if not exists summer.registrations (
  id                bigserial primary key,
  ext_id            text,                           -- HubSpot deal gt_ext_id (join key)
  app_form_ext_id   text references public.app_form (ext_id),
  hubspot_deal_id   text,
  campus            text,
  weeks             int,
  stage             text,                           -- lead | registered_unpaid | paid | attended
  amount_cents      int,
  stripe_session_id text,
  paid_at           timestamptz,
  created_at        timestamptz default now()
);

-- ───────────────────────── isolation via roles + grants ─────────────────────────
do $$
begin
  if not exists (select from pg_roles where rolname = 'gt_fall')   then create role gt_fall   nologin; end if;
  if not exists (select from pg_roles where rolname = 'gt_summer') then create role gt_summer nologin; end if;
end $$;

-- gt_fall → only schema fall
grant usage on schema fall to gt_fall;
grant select, insert, update, delete on all tables in schema fall to gt_fall;
grant usage, select on all sequences in schema fall to gt_fall;

-- gt_summer → only schema summer
grant usage on schema summer to gt_summer;
grant select, insert, update, delete on all tables in schema summer to gt_summer;
grant usage, select on all sequences in schema summer to gt_summer;

-- both program roles may read shared app_form (to resolve their own families), nothing else cross-program
grant usage on schema public to gt_fall, gt_summer;
grant select on public.app_form to gt_fall, gt_summer;

-- belt-and-suspenders: explicitly deny each program role the other's schema
revoke all on schema summer from gt_fall;
revoke all on schema fall   from gt_summer;

-- Proof (run manually): SET ROLE gt_fall; SELECT * FROM summer.registrations;  -- → permission denied for schema summer
