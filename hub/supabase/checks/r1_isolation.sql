-- R1 isolation gate — proves Postgres (not app code) enforces program isolation.
-- Doubles as the walkthrough "money shot". Idempotent: cleans its own R1-* test rows.
\set ON_ERROR_STOP off

\echo '\n========== ROLE FACTS =========='
select rolname, rolsuper as super, rolbypassrls as bypassrls, rolcanlogin as login
  from pg_roles
  where rolname in ('app_rw','staff_ro','postgres','authenticator','service_role','supabase_admin')
  order by rolname;
select current_user as conn_user,
       pg_has_role(current_user,'app_rw','member')  as conn_in_app_rw;

\echo '\n========== SEED (as connection owner) =========='
delete from enrollments where hubspot_deal_id like 'R1-%';
delete from families where email = 'r1.test@example.com';
insert into families(email, first_name, last_name) values ('r1.test@example.com','R1','Test');

\echo '\n========== SCOPED TO SUMMER (as app_rw) =========='
begin;
  set local role app_rw;
  select set_config('app.current_program',(select id::text from programs where key='summer_camp'),true) as program_set;
  insert into enrollments(program_id, family_id, hubspot_deal_id, stage, amount)
    select p.id, f.id, 'R1-summer', 'applied', 100
    from programs p, families f
    where p.key='summer_camp' and f.email='r1.test@example.com';
  select count(*) as summer_scoped_count from enrollments;                  -- expect 1
  select count(*) as fall_rows_seen_from_summer from enrollments
    where program_id=(select id from programs where key='fall_enrollment'); -- expect 0
  do $$
  begin
    insert into enrollments(program_id, family_id, hubspot_deal_id)
      select p.id, f.id, 'R1-leak' from programs p, families f
      where p.key='fall_enrollment' and f.email='r1.test@example.com';
    raise notice 'WITH CHECK: cross-program INSERT SUCCEEDED -> LEAK (BAD)';
  exception when others then
    raise notice 'WITH CHECK: cross-program INSERT blocked (GOOD): %', sqlerrm;
  end $$;
commit;

\echo '\n========== SCOPED TO FALL (as app_rw) =========='
begin;
  set local role app_rw;
  select set_config('app.current_program',(select id::text from programs where key='fall_enrollment'),true) as program_set;
  select count(*) as fall_scoped_count from enrollments;                    -- expect 0 (summer row hidden)
commit;

\echo '\n========== FAIL-CLOSED: app_rw with NO program GUC =========='
begin;
  set local role app_rw;
  select count(*) as no_guc_count from enrollments;                         -- expect 0
commit;

\echo '\n========== AS OWNER (no SET ROLE) — do the seeded rows actually exist? =========='
select count(*) as owner_visible_count from enrollments;                    -- nonzero iff owner bypasses RLS
