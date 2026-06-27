-- ============================================================================
-- 0020_gt_challenge.sql — GT Challenge end-to-end capture persistence.
--
-- The GT Challenge is the spec's worked example: a public gifted-style quiz whose
-- responses must "flow into your data store and become leads in HubSpot — routed
-- into the right program store via the Phase-1 backbone, with UTM captured."
--
-- This migration makes that real (replacing the in-memory capture contract):
--   • quiz_submissions  — the durable record of each scored submission (CRM-wide;
--     a lead exists BEFORE any program, so this is NOT program-scoped / no RLS).
--   • app_rw gains INSERT/UPDATE on families: the public capture endpoint is the
--     ORIGIN of a gifted_quiz contact (app→HubSpot). HubSpot stays authoritative
--     for lifecycle/lead_score/source — reconcile backfills hubspot_contact_id and
--     those fields on the next sweep. The app only writes app-originated columns.
--   • Qualified fits route into Fall Enrollment via program_membership (existing
--     RLS-scoped table) + a sync_outbox upsert_contact intent (existing backbone).
-- ============================================================================

create table if not exists quiz_submissions (
  id                 uuid primary key default gen_random_uuid(),
  idempotency_key    text unique not null,         -- one row per submission (idempotent capture)
  campaign_key       text not null default 'gifted_quiz',
  family_id          uuid references families(id) on delete set null,
  match_key          text,                          -- lead identity (normalized email→phone→name+zip)
  child_first_name   text,
  child_grade        text,
  parent_email       text,
  parent_phone       text,
  answers            jsonb not null,
  raw_score          int not null,
  bucket             text not null,                 -- strong_fit | promising | explore
  qualified          boolean not null,
  rationale          text,
  answer_hash        text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  status             text not null,                 -- scored | routed
  routed_program_key text,                          -- fall_enrollment when qualified
  submitted_at       timestamptz not null,
  scored_at          timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index if not exists quiz_submissions_match_key_idx on quiz_submissions (match_key);
create index if not exists quiz_submissions_qualified_idx on quiz_submissions (qualified);
create index if not exists quiz_submissions_campaign_idx on quiz_submissions (campaign_key);

-- app_rw is the ONLY runtime role; the public capture endpoint runs as it.
grant select, insert, update on quiz_submissions to app_rw;
-- The app originates the gifted_quiz lead contact; HubSpot remains authoritative
-- (reconcile fills hubspot_contact_id + HS fields). families is global (no RLS).
grant insert, update on families to app_rw;
