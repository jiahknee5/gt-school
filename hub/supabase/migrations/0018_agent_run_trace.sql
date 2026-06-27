-- 0018 — durable persistence for LLM run traces (WS6).
-- Fixes the prior audit.persisted=false gap: Ask-the-Hub (and status-gen) run traces are
-- written here when APP_RW_DATABASE_URL is configured (else the app falls back to a file
-- store). Only the SANITIZED trace is stored (graph nodes, decisions, eval rows) — never
-- raw CRM/family rows.

create table if not exists agent_run_trace (
  run_id      text primary key,
  location    text not null,           -- 'ask-the-hub' | 'status-gen'
  role        text,                    -- viewer role at call time (no PII)
  provider    text not null,           -- 'deterministic' | 'anthropic'
  model       text not null,
  started_at  timestamptz not null,
  trace       jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists agent_run_trace_started_at_idx on agent_run_trace (started_at desc);
create index if not exists agent_run_trace_location_idx on agent_run_trace (location);
