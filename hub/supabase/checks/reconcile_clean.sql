-- ONE-TIME consolidation: collapse the two-session DB state to hub/'s canonical schema.
-- Drops genrd3r9's orphan tables (superseded by the hub model) and truncates all dynamic data
-- to a clean known state. Keeps migration seeds: programs, budget_workstream, field_authority, sync_cursor.
-- Run as the owner connection (postgres); reseed with `npm run seed` afterward.
begin;

-- genrd3r9 orphans → DROP (app_form → families columns; webhook_events → processed_events;
-- sync_parity → field_state + parity_snapshot)
drop table if exists app_form     cascade;
drop table if exists webhook_events cascade;
drop table if exists sync_parity   cascade;

-- truncate all dynamic tables (owner bypasses RLS; cascade resolves FK order)
truncate
  payments, enrollments, program_membership, children,
  field_state, parity_snapshot, data_quality_issue, decisions,
  budget_entry, sync_outbox, sync_event_log, processed_events, sync_identity_map,
  families
restart identity cascade;

-- reset dynamic budget figures (keep recommended/planned from the 0001 seed)
update budget_workstream set committed = 0, actual = 0;

commit;
