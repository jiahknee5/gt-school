-- 0009_admissions.sql — Module 9 Admissions & Voice of Customer. ADDITIVE ONLY; no
-- backbone edits. Objections are tagged spans (closed theme set, deduped per source_ref);
-- content_brief is the idempotent objection→content bridge; family_quote is consent-gated
-- (no public surface without consent); marketing_feedback drives the closure-tracked loop.
-- PII lives in verbatim/quote columns (app-gated).

begin;

create table if not exists objection (
  id              uuid primary key default gen_random_uuid(),
  theme           text not null,           -- accreditation|cost|gifted_enough|scheduling|curriculum|social|tech|other
  verbatim        text,                     -- PII
  source          text not null,
  source_ref      text not null,            -- dedup anchor (thread/message id)
  theme_confidence numeric,
  retagged_by     text,
  sentiment       text,
  family_id       uuid references families(id),
  surfaced_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint objection_theme_chk check (theme in
    ('accreditation','cost','gifted_enough','scheduling','curriculum','social','tech','other')),
  constraint objection_dedupe unique (source_ref, theme)
);
create index if not exists objection_theme_idx on objection (theme);
create index if not exists objection_surfaced_idx on objection (surfaced_at);

create table if not exists content_brief (
  id               uuid primary key default gen_random_uuid(),
  objection_theme  text not null,
  verbatim_examples jsonb,
  suggested_angle  text,
  target_persona   text,
  urgency          text not null default 'normal',
  status           text not null default 'open',  -- open|in_production|published|closed
  content_ref      text,
  freq_before      integer,
  freq_after       integer,
  published_at     timestamptz,
  created_at       timestamptz not null default now()
);
-- one OPEN brief per theme (idempotent bridge)
create unique index if not exists content_brief_open_theme on content_brief (objection_theme)
  where status = 'open';

create table if not exists family_quote (
  id            uuid primary key default gen_random_uuid(),
  quote         text,                       -- PII
  sentiment     text,
  source        text,
  family_id     uuid references families(id),
  consent       boolean not null default false,  -- no public surface unless true
  redacted      boolean not null default false,
  quote_of_week boolean not null default false,
  captured_at   timestamptz not null default now()
);

create table if not exists marketing_feedback (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,                -- messaging_gap|persona_mismatch|objection_pattern|positive_signal|urgent
  note        text,
  actionable  boolean not null default false,
  decision_id uuid references decisions(id),
  status      text not null default 'open', -- open|actioned|dismissed
  flagged_at  timestamptz not null default now(),
  actioned_at timestamptz
);

-- inbound hot-family cross-link consumed here (written by Nurture/Grassroots)
create table if not exists family_flag_inbound (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid references families(id),
  origin_module text not null,
  reason        text,
  status        text not null default 'open',
  created_at    timestamptz not null default now()
);

grant select, insert, update on objection, content_brief, family_quote, marketing_feedback, family_flag_inbound to app_rw;
grant select on objection, content_brief, family_quote, marketing_feedback, family_flag_inbound to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
