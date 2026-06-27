-- 0016: user nav-scope preference + audited functional-role assignment changes.

begin;

create table if not exists nav_preference (
  user_id    text primary key references profiles(id) on delete cascade,
  nav_scope  text not null default 'my',
  updated_at timestamptz not null default now(),
  constraint nav_preference_scope_chk check (nav_scope in ('my', 'all', 'agenda'))
);

create or replace function nav_preference_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nav_preference_updated_at on nav_preference;
create trigger nav_preference_updated_at
before update on nav_preference
for each row execute function nav_preference_touch_updated_at();

create table if not exists profile_functional_role_event (
  id                      uuid primary key default gen_random_uuid(),
  actor_id                text not null references profiles(id),
  target_profile_id       text not null references profiles(id),
  from_functional_roles   text[] not null,
  to_functional_roles     text[] not null,
  from_owned_module_slugs text[] not null,
  to_owned_module_slugs   text[] not null,
  reason                  text,
  created_at              timestamptz not null default now()
);

create index if not exists profile_functional_role_event_target_idx
  on profile_functional_role_event (target_profile_id, created_at desc);

grant select, insert, update, delete on nav_preference to app_rw;
grant select on nav_preference to staff_ro;
grant select, insert on profile_functional_role_event to app_rw;
grant select on profile_functional_role_event to staff_ro;

commit;
