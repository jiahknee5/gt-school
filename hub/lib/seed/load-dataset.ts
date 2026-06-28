/**
 * load-dataset.ts — the single-source-of-truth dataset loader.
 *
 * Owner directive: ONE source of truth = the Phase 1 DB; every tab reads it. This
 * hydrates the 16 "real" backbone tables from Postgres and OVERWRITES the matching
 * fields on a base object produced by generate(). The 10 stand-in fields
 * (Meta / GA4 / X / content / summer / community / integration registry) have no DB
 * tables yet, so they — and the manifest — are KEPT from generate() (the
 * deterministic twin), which also supplies the fallback for everything.
 *
 * TYPE FIDELITY is the contract: the output is the EXACT SeedDataset shape that
 * generate() produces, because the same pure functions, ~25 pages, and the whole
 * test suite consume generate()'s shape. So:
 *   - every timestamptz/date `Date` (postgres.js parses 1082/1114/1184 → Date) is
 *     converted to an ISO string (the types declare ISO strings, e.g. created_at: string),
 *   - every `numeric` (returned by postgres.js as a string to keep precision) is
 *     Number()'d; `int` columns are already numbers and pass through,
 *   - jsonb columns (parity fields, payload, processed result, change) arrive parsed,
 *   - fixtures-only convenience fields that are NOT DB columns are derived/defaulted
 *     here, never read from a column that doesn't exist:
 *       · ProgramMembership/Enrollment/Payment.program_key  — derived from program id→key,
 *       · Family.utm_source/utm_medium/utm_campaign         — null (families persists only
 *         the field-authoritative columns; utm is a JS-only attribute, see seed.ts).
 *
 * NEVER THROWS: if APP_RW_DATABASE_URL is unset, or ANY read fails, it returns
 * generate(opts) wholesale (and logs) so every page still renders.
 */

import { withProgram, withoutProgram, type ScopedSql } from "../db";
import { generate } from "./generate";
import type {
  BudgetEntry,
  BudgetWorkstream,
  Child,
  DataQualityIssue,
  Decision,
  Enrollment,
  Family,
  FieldState,
  ParitySnapshot,
  Payment,
  ProcessedEvent,
  Program,
  ProgramMembership,
  SeedDataset,
  SyncEventLogEntry,
  SyncIdentityMapEntry,
  SyncOutboxEntry,
} from "./types";

export interface LoadDatasetOptions {
  families?: number;
  seed?: number;
}

/** The 16 fields this loader overwrites from the DB (the manifest + 10 stand-ins stay). */
type RealTables = Pick<
  SeedDataset,
  | "programs"
  | "families"
  | "children"
  | "program_membership"
  | "enrollments"
  | "payments"
  | "field_state"
  | "parity_snapshot"
  | "data_quality_issue"
  | "budget_workstream"
  | "budget_entry"
  | "decisions"
  | "processed_events"
  | "sync_event_log"
  | "sync_outbox"
  | "sync_identity_map"
>;

// --------------------------- column → field converters ---------------------------

const EPOCH = new Date(0).toISOString();

/** timestamptz/timestamp Date (postgres.js) → ISO string; null/undefined → null. */
function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : String(v);
}

/** Same, for a NOT-NULL timestamp column (the type declares a required string). */
function reqIso(v: Date | string | null | undefined): string {
  return toIso(v) ?? EPOCH;
}

/** `date` column → YYYY-MM-DD string (generate() emits date-only for due_date). */
function toIsoDate(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return typeof v === "string" ? v : null;
  return d.toISOString().slice(0, 10);
}

/** numeric (string) → number; null/undefined → null. */
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}

// --------------------------------- DB row shapes ---------------------------------
// timestamptz/date columns are typed `Date | string` (postgres.js → Date; tolerant of
// string too). `numeric` columns are typed `string | number`. jsonb arrives parsed.

interface DbProgram {
  id: string;
  key: string;
  name: string;
}

interface DbFamily {
  id: string;
  hubspot_contact_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  funnel_stage: string | null;
  tefa_status: string | null;
  income_band: string | null;
  grade: string | null;
  lifecycle_stage: string | null;
  lead_score: number | null;
  source: string | null;
  match_key: string | null;
  row_version: number;
  app_updated_at: Date | string;
  hs_updated_at: Date | string | null;
  last_synced_at: Date | string | null;
  created_at: Date | string;
}

interface DbChild {
  id: string;
  family_id: string;
  first_name: string | null;
  grade: string | null;
  created_at: Date | string;
}

interface DbFieldState {
  entity: string;
  entity_id: string;
  field: string;
  app_value: string | null;
  hs_value: string | null;
  app_updated_at: Date | string | null;
  hs_updated_at: Date | string | null;
  in_parity: boolean;
  last_checked_at: Date | string | null;
}

interface DbParitySnapshot {
  id: string;
  taken_at: Date | string;
  scope: string;
  overall_pct: string | number;
  fields: Record<string, number>;
}

interface DbDataQualityIssue {
  id: string;
  category: string;
  severity: string;
  entity: string | null;
  entity_id: string | null;
  field: string | null;
  description: string;
  status: string;
  created_at: Date | string;
  resolved_at: Date | string | null;
}

interface DbBudgetWorkstream {
  id: string;
  key: string;
  name: string;
  recommended: string | number;
  planned: string | number;
  committed: string | number;
  actual: string | number;
}

interface DbBudgetEntry {
  id: string;
  workstream_key: string;
  kind: string;
  origin: string;
  amount: string | number;
  entered_by: string;
  owner_role: string;
  note: string | null;
  campaign_key: string | null;
  created_at: Date | string;
}

interface DbDecision {
  id: string;
  question: string;
  raised_by: string | null;
  workstream: string | null;
  recommendation: string | null;
  budget_ask: string | number | null;
  due_date: Date | string | null;
  priority: string;
  status: string;
  response: string | null;
  response_note: string | null;
  auto_flag: boolean;
  resolved_at: Date | string | null;
  created_at: Date | string;
}

interface DbProcessedEvent {
  source: string;
  event_id: string;
  first_seen_at: Date | string;
  result: Record<string, unknown> | null;
}

interface DbSyncEventLog {
  id: string;
  source_system: string;
  external_event_id: string | null;
  entity: string | null;
  entity_id: string | null;
  change: Record<string, unknown> | null;
  conflict: boolean;
  received_at: Date | string;
  processed_at: Date | string | null;
}

interface DbSyncOutbox {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  target_system: string;
  op: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: Date | string;
}

interface DbSyncIdentityMap {
  id: string;
  local_table: string;
  local_id: string;
  system: string;
  external_id: string;
}

interface DbProgramMembership {
  id: string;
  program_id: string;
  family_id: string;
  child_id: string | null;
  status: string;
  source: string | null;
  joined_at: Date | string;
}

interface DbEnrollment {
  id: string;
  program_id: string;
  family_id: string;
  child_id: string | null;
  hubspot_deal_id: string | null;
  stage: string | null;
  amount: string | number | null;
  paid: boolean;
  created_at: Date | string;
}

interface DbPayment {
  id: string;
  program_id: string;
  family_id: string | null;
  enrollment_id: string | null;
  stripe_payment_intent_id: string;
  stripe_event_id: string | null;
  amount: string | number;
  status: string;
  status_rank: number;
  occurred_at: Date | string | null;
  created_at: Date | string;
}

/**
 * DS-3b fallback: if the budget_entry ledger came back empty but the workstream columns
 * hold real committed/actual, synthesize one committed + one actual entry per workstream
 * from those columns. Keeps reconcileBudget pure (empty real ledger still → $0) while a
 * DB-backed budget with the known seed-drift gap shows the true $365K split. A workstream
 * with 0 committed and 0 actual contributes nothing (stays $0). No-op when entries exist.
 */
function synthesizeBudgetEntriesIfEmpty(
  workstreams: BudgetWorkstream[],
  entries: BudgetEntry[],
): BudgetEntry[] {
  if (entries.length > 0) return entries;
  const at = new Date().toISOString();
  const synth: BudgetEntry[] = [];
  for (const w of workstreams) {
    const mk = (kind: "committed" | "actual", amount: number): BudgetEntry => ({
      id: `synth-${w.key}-${kind}`,
      workstream_key: w.key,
      kind,
      origin: "manual",
      amount,
      entered_by: "system:seed-gap",
      owner_role: "system",
      note: "synthesized from budget_workstream columns (budget_entry ledger empty)",
      campaign_key: null,
      created_at: at,
    });
    if (w.committed) synth.push(mk("committed", w.committed));
    if (w.actual) synth.push(mk("actual", w.actual));
  }
  return synth;
}

// --------------------------------- the loader ---------------------------------

export async function loadDataset(opts: LoadDatasetOptions = {}): Promise<SeedDataset> {
  // generate() ONCE: provides the manifest, the 10 stand-in fields, and a complete
  // fallback. We then overwrite the 16 real tables with live DB rows.
  const base = generate(opts);

  if (!process.env.APP_RW_DATABASE_URL) {
    console.error(
      "[load-dataset] falling back to in-memory seed:",
      new Error("APP_RW_DATABASE_URL is not set"),
    );
    return base;
  }

  try {
    const real = await readRealTables();
    return { ...base, ...real };
  } catch (err) {
    console.error("[load-dataset] falling back to in-memory seed:", err);
    return base;
  }
}

async function readRealTables(): Promise<RealTables> {
  // ---- GLOBAL tables (NOT RLS-scoped) — one transaction as app_rw, no program GUC ----
  const globals = await withoutProgram(async (sql: ScopedSql) => {
    const programs = await readPrograms(sql);
    const families = await readFamilies(sql);
    const children = await readChildren(sql);
    const field_state = await readFieldState(sql);
    const parity_snapshot = await readParitySnapshots(sql);
    const data_quality_issue = await readDataQualityIssues(sql);
    const budget_workstream = await readBudgetWorkstreams(sql);
    // DS-3b fallback at the DATA layer (keeps reconcileBudget pure): when the budget_entry
    // ledger is empty in the DB but the workstream columns carry the real committed/actual
    // (a seed-drift gap), synthesize one committed + one actual entry per workstream from
    // those columns so the $365K reconcile + burn chart don't silently zero. A genuinely
    // empty workstream (0 committed + 0 actual) stays $0.
    const budget_entry = synthesizeBudgetEntriesIfEmpty(budget_workstream, await readBudgetEntries(sql));
    const decisions = await readDecisions(sql);
    const processed_events = await readProcessedEvents(sql);
    const sync_event_log = await readSyncEventLog(sql);
    const sync_outbox = await readSyncOutbox(sql);
    const sync_identity_map = await readSyncIdentityMap(sql);
    return {
      programs,
      families,
      children,
      field_state,
      parity_snapshot,
      data_quality_issue,
      budget_workstream,
      budget_entry,
      decisions,
      processed_events,
      sync_event_log,
      sync_outbox,
      sync_identity_map,
    };
  });

  // program id → key, for the derived `program_key` convenience field on scoped rows.
  const keyById = new Map(globals.programs.map((p) => [p.id, p.key] as const));

  // ---- RLS-SCOPED tables — read per program inside its own scoped transaction ----
  const program_membership: ProgramMembership[] = [];
  const enrollments: Enrollment[] = [];
  const payments: Payment[] = [];

  for (const program of globals.programs) {
    const key = keyById.get(program.id) ?? "";
    const scoped = await withProgram(program.id, async (sql: ScopedSql) => ({
      memberships: await readProgramMembership(sql),
      enrollments: await readEnrollments(sql),
      payments: await readPayments(sql),
    }));
    for (const m of scoped.memberships) program_membership.push(mapMembership(m, key));
    for (const e of scoped.enrollments) enrollments.push(mapEnrollment(e, key));
    for (const p of scoped.payments) payments.push(mapPayment(p, key));
  }

  return { ...globals, program_membership, enrollments, payments };
}

// --------------------------------- global readers ---------------------------------

async function readPrograms(sql: ScopedSql): Promise<Program[]> {
  const rows = await sql<DbProgram[]>`select id, key, name from programs order by key`;
  return rows.map((r) => ({ id: r.id, key: r.key, name: r.name }));
}

async function readFamilies(sql: ScopedSql): Promise<Family[]> {
  const rows = await sql<DbFamily[]>`
    select id, hubspot_contact_id, email, phone, first_name, last_name,
           funnel_stage, tefa_status, income_band, grade,
           lifecycle_stage, lead_score, source, match_key, row_version,
           app_updated_at, hs_updated_at, last_synced_at, created_at
    from families
    order by created_at, id`;
  return rows.map((r) => ({
    id: r.id,
    hubspot_contact_id: r.hubspot_contact_id,
    email: r.email,
    phone: r.phone,
    first_name: r.first_name,
    last_name: r.last_name,
    funnel_stage: r.funnel_stage,
    tefa_status: r.tefa_status,
    income_band: r.income_band,
    grade: r.grade,
    lifecycle_stage: r.lifecycle_stage,
    lead_score: r.lead_score,
    source: r.source,
    // Not DB columns — families persists only the field-authoritative columns; utm_* is a
    // JS-only attribute (seed.ts storage note). Defaulted to null to preserve the shape.
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    match_key: r.match_key,
    row_version: r.row_version,
    app_updated_at: reqIso(r.app_updated_at),
    hs_updated_at: toIso(r.hs_updated_at),
    last_synced_at: toIso(r.last_synced_at),
    created_at: reqIso(r.created_at),
  }));
}

async function readChildren(sql: ScopedSql): Promise<Child[]> {
  const rows = await sql<DbChild[]>`
    select id, family_id, first_name, grade, created_at
    from children
    order by created_at, id`;
  return rows.map((r) => ({
    id: r.id,
    family_id: r.family_id,
    first_name: r.first_name,
    grade: r.grade,
    created_at: reqIso(r.created_at),
  }));
}

async function readFieldState(sql: ScopedSql): Promise<FieldState[]> {
  const rows = await sql<DbFieldState[]>`
    select entity, entity_id, field, app_value, hs_value,
           app_updated_at, hs_updated_at, in_parity, last_checked_at
    from field_state
    order by entity_id, field`;
  return rows.map((r) => ({
    entity: r.entity,
    entity_id: r.entity_id,
    field: r.field,
    app_value: r.app_value,
    hs_value: r.hs_value,
    app_updated_at: toIso(r.app_updated_at),
    hs_updated_at: toIso(r.hs_updated_at),
    in_parity: r.in_parity,
    last_checked_at: toIso(r.last_checked_at),
  }));
}

async function readParitySnapshots(sql: ScopedSql): Promise<ParitySnapshot[]> {
  const rows = await sql<DbParitySnapshot[]>`
    select id, taken_at, scope, overall_pct, fields
    from parity_snapshot
    order by taken_at`;
  return rows.map((r) => ({
    id: r.id,
    taken_at: reqIso(r.taken_at),
    scope: r.scope,
    overall_pct: Number(r.overall_pct),
    fields: r.fields ?? {},
  }));
}

async function readDataQualityIssues(sql: ScopedSql): Promise<DataQualityIssue[]> {
  const rows = await sql<DbDataQualityIssue[]>`
    select id, category, severity, entity, entity_id, field, description,
           status, created_at, resolved_at
    from data_quality_issue
    order by created_at`;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    severity: r.severity,
    entity: r.entity,
    entity_id: r.entity_id,
    field: r.field,
    description: r.description,
    status: r.status,
    created_at: reqIso(r.created_at),
    resolved_at: toIso(r.resolved_at),
  }));
}

async function readBudgetWorkstreams(sql: ScopedSql): Promise<BudgetWorkstream[]> {
  const rows = await sql<DbBudgetWorkstream[]>`
    select id, key, name, recommended, planned, committed, actual
    from budget_workstream
    order by key`;
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    recommended: Number(r.recommended),
    planned: Number(r.planned),
    committed: Number(r.committed),
    actual: Number(r.actual),
  }));
}

async function readBudgetEntries(sql: ScopedSql): Promise<BudgetEntry[]> {
  const rows = await sql<DbBudgetEntry[]>`
    select id, workstream_key, kind, origin, amount, entered_by, owner_role,
           note, campaign_key, created_at
    from budget_entry
    order by created_at, id`;
  return rows.map((r) => ({
    id: r.id,
    workstream_key: r.workstream_key,
    kind: r.kind as BudgetEntry["kind"],
    origin: r.origin as BudgetEntry["origin"],
    amount: Number(r.amount),
    entered_by: r.entered_by,
    owner_role: r.owner_role,
    note: r.note,
    campaign_key: r.campaign_key,
    created_at: reqIso(r.created_at),
  }));
}

async function readDecisions(sql: ScopedSql): Promise<Decision[]> {
  const rows = await sql<DbDecision[]>`
    select id, question, raised_by, workstream, recommendation, budget_ask,
           due_date, priority, status, response, response_note, auto_flag,
           resolved_at, created_at
    from decisions
    order by created_at`;
  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    raised_by: r.raised_by,
    workstream: r.workstream,
    recommendation: r.recommendation,
    budget_ask: numOrNull(r.budget_ask),
    due_date: toIsoDate(r.due_date),
    priority: r.priority,
    status: r.status,
    response: r.response,
    response_note: r.response_note,
    auto_flag: r.auto_flag,
    resolved_at: toIso(r.resolved_at),
    created_at: reqIso(r.created_at),
  }));
}

async function readProcessedEvents(sql: ScopedSql): Promise<ProcessedEvent[]> {
  const rows = await sql<DbProcessedEvent[]>`
    select source, event_id, first_seen_at, result
    from processed_events
    order by first_seen_at`;
  return rows.map((r) => ({
    source: r.source,
    event_id: r.event_id,
    first_seen_at: reqIso(r.first_seen_at),
    result: r.result,
  }));
}

async function readSyncEventLog(sql: ScopedSql): Promise<SyncEventLogEntry[]> {
  const rows = await sql<DbSyncEventLog[]>`
    select id, source_system, external_event_id, entity, entity_id, change,
           conflict, received_at, processed_at
    from sync_event_log
    order by received_at, id`;
  return rows.map((r) => ({
    id: r.id,
    source_system: r.source_system,
    external_event_id: r.external_event_id,
    entity: r.entity,
    entity_id: r.entity_id,
    change: r.change,
    conflict: r.conflict,
    received_at: reqIso(r.received_at),
    processed_at: toIso(r.processed_at),
  }));
}

async function readSyncOutbox(sql: ScopedSql): Promise<SyncOutboxEntry[]> {
  const rows = await sql<DbSyncOutbox[]>`
    select id, aggregate_type, aggregate_id, target_system, op, payload,
           dedupe_key, status, attempts, last_error, created_at
    from sync_outbox
    order by created_at, id`;
  return rows.map((r) => ({
    id: r.id,
    aggregate_type: r.aggregate_type,
    aggregate_id: r.aggregate_id,
    target_system: r.target_system,
    op: r.op,
    payload: r.payload,
    dedupe_key: r.dedupe_key,
    status: r.status,
    attempts: r.attempts,
    last_error: r.last_error,
    created_at: reqIso(r.created_at),
  }));
}

async function readSyncIdentityMap(sql: ScopedSql): Promise<SyncIdentityMapEntry[]> {
  const rows = await sql<DbSyncIdentityMap[]>`
    select id, local_table, local_id, system, external_id
    from sync_identity_map
    order by id`;
  return rows.map((r) => ({
    id: r.id,
    local_table: r.local_table,
    local_id: r.local_id,
    system: r.system,
    external_id: r.external_id,
  }));
}

// --------------------------------- scoped readers ---------------------------------

async function readProgramMembership(sql: ScopedSql): Promise<DbProgramMembership[]> {
  return sql<DbProgramMembership[]>`
    select id, program_id, family_id, child_id, status, source, joined_at
    from program_membership
    order by joined_at, id`;
}

async function readEnrollments(sql: ScopedSql): Promise<DbEnrollment[]> {
  return sql<DbEnrollment[]>`
    select id, program_id, family_id, child_id, hubspot_deal_id, stage, amount, paid, created_at
    from enrollments
    order by created_at, id`;
}

async function readPayments(sql: ScopedSql): Promise<DbPayment[]> {
  return sql<DbPayment[]>`
    select id, program_id, family_id, enrollment_id, stripe_payment_intent_id,
           stripe_event_id, amount, status, status_rank, occurred_at, created_at
    from payments
    order by created_at, id`;
}

function mapMembership(r: DbProgramMembership, programKey: string): ProgramMembership {
  return {
    id: r.id,
    program_id: r.program_id,
    program_key: programKey, // derived (not a DB column)
    family_id: r.family_id,
    child_id: r.child_id,
    status: r.status,
    source: r.source,
    joined_at: reqIso(r.joined_at),
  };
}

function mapEnrollment(r: DbEnrollment, programKey: string): Enrollment {
  return {
    id: r.id,
    program_id: r.program_id,
    program_key: programKey, // derived (not a DB column)
    family_id: r.family_id,
    child_id: r.child_id,
    hubspot_deal_id: r.hubspot_deal_id,
    stage: r.stage,
    amount: numOrNull(r.amount),
    paid: r.paid,
    created_at: reqIso(r.created_at),
  };
}

function mapPayment(r: DbPayment, programKey: string): Payment {
  return {
    id: r.id,
    program_id: r.program_id,
    program_key: programKey, // derived (not a DB column)
    family_id: r.family_id,
    enrollment_id: r.enrollment_id,
    stripe_payment_intent_id: r.stripe_payment_intent_id,
    stripe_event_id: r.stripe_event_id,
    amount: Number(r.amount),
    status: r.status,
    status_rank: r.status_rank,
    occurred_at: toIso(r.occurred_at),
    created_at: reqIso(r.created_at),
  };
}
