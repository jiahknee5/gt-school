-- Restricted application role for the runtime read-write path (APP_RW_DATABASE_URL).
-- NOSUPERUSER, NOBYPASSRLS → a leaked app credential can neither escalate nor bypass row security.
-- Run AFTER 01_schema.sql, passing a password that stays out of git:
--   psql "$SUPABASE_MIGRATION_DB_URL" -v app_rw_password="$(openssl rand -hex 24)" -f db/02_app_role.sql
-- then put that password into APP_RW_DATABASE_URL in .env.local.

do $$
begin
  if not exists (select from pg_roles where rolname = 'app_rw') then
    create role app_rw login nosuperuser nobypassrls;
  end if;
end $$;

-- set/rotate the password (psql var is substituted here — outside the dollar-quoted block).
-- NB: Supabase's postgres role isn't a true superuser, so it can't re-assert NOSUPERUSER/NOBYPASSRLS
-- via ALTER (that attribute is superuser-only). The role already carries them from CREATE above.
alter role app_rw with login password :'app_rw_password';

-- least privilege: CRUD on shared app data, no DDL, no role management
grant usage on schema public to app_rw;
grant select, insert, update, delete on all tables in schema public to app_rw;
grant usage, select on all sequences in schema public to app_rw;
alter default privileges in schema public grant select, insert, update, delete on tables to app_rw;
alter default privileges in schema public grant usage, select on sequences to app_rw;

-- app_rw is the app server: it may ASSUME either program role (one per request via SET LOCAL ROLE),
-- but holds no direct grants on the program schemas itself — so a request must pick a program to see its data.
grant usage on schema fall, summer to app_rw;
grant gt_fall, gt_summer to app_rw;
