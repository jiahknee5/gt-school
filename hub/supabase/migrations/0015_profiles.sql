-- 0015_profiles.sql — server-owned user profiles + audited role changes.
-- PRD v2 requires hard Admin/Leader/Operator gates and per-user Home state.
-- Permission tier is therefore profile-owned server data, not a user-editable preference.

begin;

do $$ begin create type permission_tier as enum ('admin','leader','operator');
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id                  text primary key,
  email               text unique not null,
  display_name        text not null,
  permission_tier     permission_tier not null,
  title               text,
  functional_roles    text[] not null default '{}',
  owned_module_slugs  text[] not null default '{}',
  owned_workstreams   text[] not null default '{}',
  status              text not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  role_updated_at     timestamptz not null default now(),
  role_updated_by     text references profiles(id),
  constraint profiles_status_chk check (status in ('active','disabled'))
);

create index if not exists profiles_permission_tier_idx on profiles (permission_tier);
create index if not exists profiles_status_idx on profiles (status);

create table if not exists profile_role_event (
  id                uuid primary key default gen_random_uuid(),
  actor_id          text not null references profiles(id),
  target_profile_id text not null references profiles(id),
  from_permission_tier permission_tier not null,
  to_permission_tier   permission_tier not null,
  reason            text,
  created_at        timestamptz not null default now()
);

create index if not exists profile_role_event_target_idx
  on profile_role_event (target_profile_id, created_at desc);
create index if not exists profile_role_event_actor_idx
  on profile_role_event (actor_id, created_at desc);

create or replace function profiles_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
before update on profiles
for each row execute function profiles_touch_updated_at();

insert into profiles
  (id, email, display_name, permission_tier, title, functional_roles,
   owned_module_slugs, owned_workstreams)
values
  ('marketing-lead', 'marketing-lead@gt.school', 'Johnny Chung', 'admin',
   'Marketing Lead', array['Marketing Lead'], array['dashboard','nurture','crm-ops','analytics'],
   array['foundations','thought_leadership','grassroots','guerrilla']),
  ('growth-leader', 'growth-leader@gt.school', 'David Chen', 'leader',
   'Growth Marketing Officer', array['Growth Marketing Officer'], array[]::text[],
   array['guerrilla']),
  ('budget-owner', 'budget-owner@gt.school', 'Priya Anand', 'leader',
   'Budget Owner', array['Budget Owner'], array['budget'], array[]::text[]),
  ('cofounder', 'cofounder@gt.school', 'Dave Reynolds', 'leader',
   'Co-founder, GT Anywhere', array['Co-founder'], array[]::text[], array[]::text[]),
  ('content-operator', 'content@gt.school', 'Maya Patel', 'operator',
   'Content Owner', array['Content Owner'], array['content','summer-camp'],
   array['thought_leadership']),
  ('grassroots-operator', 'grassroots@gt.school', 'Sofia Reyes', 'operator',
   'Grassroots Owner', array['Grassroots Owner'], array['grassroots'],
   array['grassroots']),
  ('field-events-operator', 'field-events@gt.school', 'Marcus Hill', 'operator',
   'Field & Events Owner', array['Field & Events Owner'], array['events','admissions'],
   array[]::text[]),
  ('admissions-operator', 'admissions@gt.school', 'Hannah Brooks', 'operator',
   'Admissions Owner', array['Admissions Owner'], array['admissions'], array[]::text[])
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  title = excluded.title,
  functional_roles = excluded.functional_roles,
  owned_module_slugs = excluded.owned_module_slugs,
  owned_workstreams = excluded.owned_workstreams,
  updated_at = now();

grant select, insert, update on profiles to app_rw;
grant select, insert on profile_role_event to app_rw;
grant select on profiles, profile_role_event to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
