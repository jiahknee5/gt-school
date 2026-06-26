-- 0014_decision_audit.sql — append-only audit trail for Decision Queue rulings (security finding S6).
-- ADDITIVE: adds an attribution column to the existing global `decisions` table and a new
-- append-only `decision_event` table. Touches no backbone column and no program-scoped table.
-- "Append-only" is enforced by grant: app_rw may INSERT + SELECT, never UPDATE/DELETE, so the
-- trail of who ruled what (and when) cannot be silently rewritten from the app path.

begin;

-- Last actor recorded directly on the ruling for cheap "who decided this" reads. The full
-- history (including need_info round-trips) lives in decision_event.
alter table decisions add column if not exists decided_by text;

create table if not exists decision_event (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id),
  actor_id    text not null,                 -- session user id (e.g. growth-leader)
  actor_name  text,                          -- display name at time of ruling
  actor_role  text not null,                 -- leader (re-checked server-side before write)
  action      text not null,                 -- approve | reject | need_info
  from_status text not null,                 -- status before the transition
  to_status   text not null,                 -- status after the transition
  note        text,                          -- leadership note captured with the ruling
  created_at  timestamptz not null default now()
);

create index if not exists decision_event_decision_idx on decision_event (decision_id, created_at);

-- Append-only from the app: insert + select, never update/delete.
grant select, insert on decision_event to app_rw;

commit;
