-- 0002_sync_cursor.sql — global reconciliation watermark (additive; 0001 is untouched).
-- The one table genrd3r9's backbone genuinely needs that 0001 lacked: a per-source "modified-since"
-- cursor for the reconciliation sweep (families.last_synced_at is per-row, not a global watermark).
begin;

create table if not exists sync_cursor (
  key         text primary key,        -- e.g. 'hubspot:contacts', 'hubspot:deals'
  last_synced timestamptz,
  updated_at  timestamptz not null default now()
);

grant select, insert, update on sync_cursor to app_rw;

insert into sync_cursor (key, last_synced) values
  ('hubspot:contacts', null),
  ('hubspot:deals', null)
on conflict (key) do nothing;

commit;
