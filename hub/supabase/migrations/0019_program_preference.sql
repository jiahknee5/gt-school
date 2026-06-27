-- 0019_program_preference.sql — the active-program view lens persisted per user.
-- The program-scope feature (lib/program-preference.ts) reads/writes a `program_preference`
-- row when APP_RW_DATABASE_URL is set, mirroring nav_preference, but no migration created
-- the table. Without it every authenticated render errored on the read and (on the Supavisor
-- transaction pooler) poisoned the connection pool → the page hung. This adds it.

begin;

create table if not exists program_preference (
  user_id       text primary key references profiles(id) on delete cascade,
  program_scope text not null default 'fall_enrollment',
  updated_at    timestamptz not null default now(),
  constraint program_preference_scope_chk
    check (program_scope in ('fall_enrollment', 'summer_camp', 'all'))
);

-- App reads/writes (the program toggle) through app_rw; upsert needs update.
grant select, insert, update, delete on program_preference to app_rw;
grant select on program_preference to staff_ro;

commit;
