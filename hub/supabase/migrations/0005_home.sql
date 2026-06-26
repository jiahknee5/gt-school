-- 0005_home.sql — per-user Home layout persistence.
-- Home owns only layout/personalization state here. Widget metrics still read from
-- their owning modules; this table stores the actor's chosen widget keys, order, and
-- size so add/remove/reorder survives a new session.

begin;

create table if not exists home_layout (
  id         uuid primary key default gen_random_uuid(),
  user_id    text unique not null,
  role       text not null,
  widgets    jsonb not null default '[]'::jsonb,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint home_layout_role_chk check (role in ('admin','leader','operator')),
  constraint home_layout_widgets_array_chk check (jsonb_typeof(widgets) = 'array')
);

create index if not exists home_layout_user_idx on home_layout (user_id);

create or replace function home_layout_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists home_layout_updated_at on home_layout;
create trigger home_layout_updated_at
before update on home_layout
for each row execute function home_layout_touch_updated_at();

grant select, insert, update, delete on home_layout to app_rw;
grant select on home_layout to staff_ro;
grant usage, select on all sequences in schema public to app_rw;

commit;
