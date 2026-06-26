-- 0010_content.sql — Module 3 Content & Thought Leadership. ADDITIVE ONLY; no backbone
-- edits. content_pieces mirrors the Google Sheet (production status SoT) + cross-link
-- stubs; content_sync_state is the field-level bidirectional reconcile (conflict, never
-- clobber); content_metrics keeps channels DISTINCT (no blended "social"); the brand-voice
-- auditor is advisory (suggest-only, never gates).

begin;

create table if not exists content_pieces (
  id              uuid primary key default gen_random_uuid(),
  sheet_row_id    text unique,                 -- maps to the Google Sheet row (sync key)
  title           text not null,
  owner           text,
  type            text,                        -- video|podcast|article|social|email
  status          text not null default 'concept', -- concept|in_production|review|scheduled|published
  channel         text,                        -- substack|x|instagram|facebook|podcast|email|youtube
  persona_target  text,
  due_date        date,
  publish_date    date,
  deliverable_link text,
  attachments     jsonb,
  utm_campaign    text,                        -- nullable → "(not set)"; never dropped
  source          text not null default 'sheet', -- sheet|grassroots_stub|voc_brief|camp_xref
  origin_ref      uuid,                        -- cross-link source id
  consent_status  text not null default 'not_required', -- required≠ok blocks advance for grassroots_stub
  program_key     text,                        -- summer_camp rows read-only here
  row_version     int not null default 1,
  sheet_updated_at timestamptz,
  app_updated_at  timestamptz,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  constraint content_status_chk check (status in
    ('concept','in_production','review','scheduled','published'))
);
create index if not exists content_pieces_status_idx on content_pieces (status);
create index if not exists content_pieces_channel_idx on content_pieces (channel);

create table if not exists content_sync_state (
  id              uuid primary key default gen_random_uuid(),
  piece_id        uuid references content_pieces(id),
  sheet_row_id    text,
  field           text not null,
  app_value       text,
  sheet_value     text,                        -- both retained on conflict
  app_updated_at  timestamptz,
  sheet_updated_at timestamptz,
  in_parity       boolean not null default true,
  conflict        boolean not null default false,  -- both edited since last sync
  last_checked_at timestamptz not null default now()
);
create index if not exists content_sync_conflict_idx on content_sync_state (conflict);

create table if not exists content_metrics (
  id                    uuid primary key default gen_random_uuid(),
  piece_id              uuid references content_pieces(id),
  channel               text not null,         -- x|facebook|instagram|substack|podcast|email (distinct)
  source                text,                  -- meta|x_api|hubspot|manual
  reach                 numeric,
  impressions           numeric,
  clicks                numeric,
  engagements           numeric,
  conversions_attributed int,                  -- from app_form × utm
  period                date
);

create table if not exists brand_voice_suggestion (
  id            uuid primary key default gen_random_uuid(),
  piece_id      uuid references content_pieces(id),
  draft_ref     text,
  span_start    int,
  span_end      int,
  original_text text,
  suggested_text text,
  rationale     text,
  status        text not null default 'suggested', -- suggested|accepted|dismissed (never gates publish)
  created_at    timestamptz not null default now()
);

grant select, insert, update on content_pieces, content_sync_state, content_metrics, brand_voice_suggestion to app_rw;
grant select on content_pieces, content_sync_state, content_metrics, brand_voice_suggestion to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
