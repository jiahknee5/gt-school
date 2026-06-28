-- ============================================================================
-- 0021_gt_challenge_lead_enrichment.sql — carry the FULL GT Challenge lead to HubSpot.
--
-- The capture path already persists the scored submission, originates a families
-- lead, and enqueues an upsert_contact intent. But the live deposit flow shipped a
-- near-empty contact ("GT"/"(GT lead)") and a bare deal. To forward the rich lead
-- (name, phone, zip, grade band, UTM, fit bucket, score, consent) we need two
-- app-originated columns that did not exist:
--   • families.zip            — the parent ZIP collected at capture (standard HubSpot `zip`).
--   • quiz_submissions.consent_at — when the consent gate was satisfied (gt_consent_at).
-- families.last_name already exists (0001_backbone.sql); added IF NOT EXISTS for safety.
--
-- All idempotent (IF NOT EXISTS). app_rw already holds insert/update on both tables
-- (0020); the grants below are belt-and-suspenders so a fresh apply is self-contained.
-- ============================================================================

alter table families         add column if not exists zip          text;
alter table families         add column if not exists last_name     text;
alter table quiz_submissions add column if not exists consent_at    timestamptz;

grant insert, update on families to app_rw;
grant select, insert, update on quiz_submissions to app_rw;
