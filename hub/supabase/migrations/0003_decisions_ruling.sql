-- 0003_decisions_ruling.sql — Leader ruling route access for global Decision Queue rows.
-- decisions is a global Hub-owned table gated at the app/RBAC layer, not program-scoped RLS.
-- The app runs as app_rw inside transactions, so app_rw needs explicit select/update here.

begin;

grant select, update on decisions to app_rw;

create index if not exists decisions_status_due_idx on decisions (status, due_date, priority);

commit;
