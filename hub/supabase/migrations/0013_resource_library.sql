-- 0013_resource_library.sql — Module 12 Resource Library. ADDITIVE ONLY; no backbone edits.
-- The Library is SSOT for resource METADATA only — access/download counts are NOT a column
-- here (they are a read-only join from ga4_days.eventCount_pdf_download). visibility is the
-- RBAC see-gate (leadership rows returned only to Leader/Admin). file_type is derived from
-- URL/MIME at write time, never free text. is_sample marks the mocked pre-load (reset state).

begin;

create table if not exists resources (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  kind            text not null,            -- link|file
  url             text,                      -- external URL when kind=link
  storage_path    text,                      -- object-store path when kind=file
  file_type       text not null,             -- DOC|SHEET|SLIDES|PDF|MD|HTML (derived)
  tags            text[] not null,           -- controlled vocab ⊆ {strategy,data,creative,persona,playbook}; ≥1
  owner           text not null,
  visibility      text not null default 'all', -- all|leadership (RBAC gate)
  link_checked_at timestamptz,
  link_ok         boolean,                   -- false → "link unreachable" state
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint resources_tags_nonempty check (array_length(tags, 1) >= 1),
  constraint resources_visibility_chk check (visibility in ('all','leadership'))
);
create index if not exists resources_tags_idx on resources using gin (tags);
create index if not exists resources_visibility_idx on resources (visibility);

-- RLS: leadership-only rows are returned to Leader/Admin contexts only.
alter table resources enable row level security;
do $$ begin
  create policy resources_visibility_gate on resources
    using (visibility = 'all' or current_setting('app.role', true) in ('admin','leader'));
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on resources to app_rw;
grant select on resources to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
