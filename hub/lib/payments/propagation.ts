import { withProgram, withoutProgram } from "../db";
import { generate } from "../seed/generate";
import type {
  Enrollment,
  Payment,
  ProcessedEvent,
  Program,
  SeedDataset,
  SyncEventLogEntry,
  SyncOutboxEntry,
} from "../seed/types";

export type PaymentWatcherSource = "live-db" | "seed-fixture";
export type ContaminationStatus = "isolated" | "contaminated";

/**
 * A human label for WHICH database the live rows were written to — the host + database
 * name parsed from APP_RW_DATABASE_URL (and the Supabase project ref from the username
 * when present). Credentials (user:password) are NEVER included.
 */
function liveDbLabel(): string {
  const url = process.env.APP_RW_DATABASE_URL;
  if (!url) return "Live DB";
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, "") || "postgres";
    const ref = decodeURIComponent(u.username).split(".")[1]; // Supabase user is postgres.<projectref>
    const who = ref ? `Supabase ${ref}` : u.hostname;
    return `Live DB · ${who} · ${u.hostname}/${db}`;
  } catch {
    return "Live DB";
  }
}
export type CrmSyncStatus =
  | "done"
  | "queued"
  | "dead"
  | "missing"
  | "seed-implied"
  | "not-applicable";

export interface PaymentPropagationInput {
  source: PaymentWatcherSource;
  sourceLabel?: string;
  generatedAt: string;
  programs: Program[];
  payments: PaymentFact[];
  enrollments: EnrollmentFact[];
  processedEvents: ProcessedEvent[];
  syncEventLog: SyncEventLogEntry[];
  syncOutbox: SyncOutboxEntry[];
  liveLimitations?: string[];
}

export interface PaymentFact extends Payment {
  program_name?: string;
}

export interface EnrollmentFact extends Enrollment {
  program_name?: string;
}

export interface ProgramPaymentSummary {
  programId: string;
  programKey: string;
  programName: string;
  paymentCount: number;
  processedEventCount: number;
  succeededCount: number;
  failedCount: number;
  refundedCount: number;
  amount: number;
}

export interface PaymentWatchRow {
  paymentId: string;
  eventId: string | null;
  eventStatus: string;
  intentId: string;
  programId: string;
  programKey: string;
  programName: string;
  familyId: string | null;
  enrollmentId: string | null;
  enrollmentStage: string | null;
  enrollmentPaid: boolean | null;
  hubspotDealId: string | null;
  amount: number;
  paymentStatus: string;
  statusRank: number;
  occurredAt: string | null;
  createdAt: string | null;
  deliveries: number;
  processedDeliveries: number;
  duplicateDeliveries: number;
  processedLedgerRows: number;
  paymentRowsForIntent: number;
  idempotentReplayVisible: boolean;
  visibleProgramKeys: string[];
  contaminationStatus: ContaminationStatus;
  crmSyncStatus: CrmSyncStatus;
  outboxDedupeKey: string | null;
  outboxStatus: string | null;
}

export interface IdempotencySignal {
  eventId: string | null;
  intentId: string | null;
  deliveries: number;
  processedDeliveries: number;
  duplicateDeliveries: number;
  processedLedgerRows: number;
  paymentRowsForIntent: number;
  replayNoOpVisible: boolean;
  row: PaymentWatchRow | null;
}

export interface ContaminationSignal {
  noContamination: boolean;
  crossProgramEnrollmentMismatches: Array<{
    paymentId: string;
    paymentProgramKey: string;
    enrollmentProgramKey: string;
  }>;
  crossProgramIntentContamination: Array<{
    intentId: string;
    programKeys: string[];
  }>;
  familiesInMultiplePrograms: number;
  isolatedPaymentRows: number;
}

export interface PaymentPropagationSignals {
  processedEventStatusVisible: boolean;
  paymentStatusVisible: boolean;
  programIsolationVisible: boolean;
  idempotentReplayVisible: boolean;
  contaminationSignalVisible: boolean;
  demoPathAvailable: boolean;
}

export interface PaymentPropagationSummary {
  source: PaymentWatcherSource;
  sourceLabel: string;
  generatedAt: string;
  programs: ProgramPaymentSummary[];
  rows: PaymentWatchRow[];
  selected: PaymentWatchRow | null;
  idempotency: IdempotencySignal;
  contamination: ContaminationSignal;
  signals: PaymentPropagationSignals;
  demoPath: string[];
  liveLimitations: string[];
}

interface DbProgram {
  id: string;
  key: string;
  name: string;
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

const SEED_OPPORTUNISTIC_LIMITATION =
  "Seed fallback shows processed_events, payments, and duplicate delivery logs. Per-payment HubSpot patch_deal outbox rows are live-handler facts, so seed rows mark CRM writeback as seed-implied when a succeeded enrollment has a HubSpot deal id.";

export function buildSeedPaymentPropagationSummary(
  dataset: SeedDataset = generate({ seed: 5, families: 800 }),
  liveLimitations: string[] = [],
): PaymentPropagationSummary {
  const programNameById = new Map(dataset.programs.map((p) => [p.id, p.name]));
  return buildPaymentPropagationSummary({
    source: "seed-fixture",
    generatedAt: dataset.manifest.generatedAt,
    programs: dataset.programs,
    payments: dataset.payments.map((p) => ({
      ...p,
      program_name: programNameById.get(p.program_id),
    })),
    enrollments: dataset.enrollments.map((e) => ({
      ...e,
      program_name: programNameById.get(e.program_id),
    })),
    processedEvents: dataset.processed_events,
    syncEventLog: dataset.sync_event_log,
    syncOutbox: dataset.sync_outbox,
    liveLimitations: [...liveLimitations, SEED_OPPORTUNISTIC_LIMITATION],
  });
}

export async function readPaymentPropagationSummary(): Promise<PaymentPropagationSummary> {
  if (!process.env.APP_RW_DATABASE_URL) {
    return buildSeedPaymentPropagationSummary(undefined, [
      "APP_RW_DATABASE_URL is not set; showing deterministic generated seed facts instead of live database rows.",
    ]);
  }

  try {
    return await readLivePaymentPropagationSummary();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return buildSeedPaymentPropagationSummary(undefined, [
      `Live payment watcher query failed (${detail}); showing deterministic generated seed facts instead.`,
    ]);
  }
}

export async function readLivePaymentPropagationSummary(): Promise<PaymentPropagationSummary> {
  const dbPrograms = await withoutProgram((sql) =>
    sql<DbProgram[]>`select id, key, name from programs order by key`,
  );
  const programs: Program[] = dbPrograms.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }));

  const payments: PaymentFact[] = [];
  const enrollments: EnrollmentFact[] = [];

  for (const program of programs) {
    const scopedPayments = await withProgram(program.id, (sql) =>
      sql<DbPayment[]>`
        select id, program_id, family_id, enrollment_id, stripe_payment_intent_id,
               stripe_event_id, amount, status, status_rank, occurred_at, created_at
        from payments
        order by coalesce(occurred_at, created_at) desc
        limit 120`,
    );
    payments.push(
      ...scopedPayments.map((p) => ({
        id: p.id,
        program_id: p.program_id,
        program_key: program.key,
        program_name: program.name,
        family_id: p.family_id,
        enrollment_id: p.enrollment_id,
        stripe_payment_intent_id: p.stripe_payment_intent_id,
        stripe_event_id: p.stripe_event_id,
        amount: Number(p.amount),
        status: p.status,
        status_rank: p.status_rank,
        occurred_at: toIso(p.occurred_at),
        created_at: toIso(p.created_at) ?? new Date(0).toISOString(),
      })),
    );

    const scopedEnrollments = await withProgram(program.id, (sql) =>
      sql<DbEnrollment[]>`
        select id, program_id, family_id, child_id, hubspot_deal_id, stage, amount, paid, created_at
        from enrollments
        order by created_at desc
        limit 240`,
    );
    enrollments.push(
      ...scopedEnrollments.map((e) => ({
        id: e.id,
        program_id: e.program_id,
        program_key: program.key,
        program_name: program.name,
        family_id: e.family_id,
        child_id: e.child_id,
        hubspot_deal_id: e.hubspot_deal_id,
        stage: e.stage,
        amount: e.amount == null ? null : Number(e.amount),
        paid: e.paid,
        created_at: toIso(e.created_at) ?? new Date(0).toISOString(),
      })),
    );
  }

  const eventIds = unique(payments.map((p) => p.stripe_event_id).filter(isPresent));
  const processedEvents = eventIds.length
    ? await withoutProgram((sql) =>
        sql<DbProcessedEvent[]>`
          select source, event_id, first_seen_at, result
          from processed_events
          where source = 'stripe' and event_id in ${sql(eventIds)}`,
      )
    : [];
  const eventLog = eventIds.length
    ? await withoutProgram((sql) =>
        sql<DbSyncEventLog[]>`
          select id, source_system, external_event_id, entity, entity_id, change,
                 conflict, received_at, processed_at
          from sync_event_log
          where source_system = 'stripe' and external_event_id in ${sql(eventIds)}`,
      )
    : [];
  const dedupeKeys = eventIds.map((eventId) => `stripe:${eventId}`);
  const syncOutbox = dedupeKeys.length
    ? await withoutProgram((sql) =>
        sql<DbSyncOutbox[]>`
          select id, aggregate_type, aggregate_id, target_system, op, payload, dedupe_key,
                 status, attempts, last_error, created_at
          from sync_outbox
          where dedupe_key in ${sql(dedupeKeys)}`,
      )
    : [];

  return buildPaymentPropagationSummary({
    source: "live-db",
    sourceLabel: liveDbLabel(),
    generatedAt: new Date().toISOString(),
    programs,
    payments,
    enrollments,
    processedEvents: processedEvents.map((e) => ({
      source: e.source,
      event_id: e.event_id,
      first_seen_at: toIso(e.first_seen_at) ?? new Date(0).toISOString(),
      result: e.result,
    })),
    syncEventLog: eventLog.map((e) => ({
      id: e.id,
      source_system: e.source_system,
      external_event_id: e.external_event_id,
      entity: e.entity,
      entity_id: e.entity_id,
      change: e.change,
      conflict: e.conflict,
      received_at: toIso(e.received_at) ?? new Date(0).toISOString(),
      processed_at: toIso(e.processed_at),
    })),
    syncOutbox: syncOutbox.map((o) => ({
      id: o.id,
      aggregate_type: o.aggregate_type,
      aggregate_id: o.aggregate_id,
      target_system: o.target_system,
      op: o.op,
      payload: o.payload,
      dedupe_key: o.dedupe_key,
      status: o.status,
      attempts: o.attempts,
      last_error: o.last_error,
      created_at: toIso(o.created_at) ?? new Date(0).toISOString(),
    })),
    liveLimitations: [],
  });
}

export function buildPaymentPropagationSummary(
  input: PaymentPropagationInput,
): PaymentPropagationSummary {
  const programById = new Map(input.programs.map((p) => [p.id, p]));
  const enrollmentById = new Map(input.enrollments.map((e) => [e.id, e]));
  const processedByEvent = groupBy(
    input.processedEvents.filter((e) => e.source === "stripe"),
    (e) => e.event_id,
  );
  const logsByEvent = groupBy(
    input.syncEventLog.filter((e) => e.source_system === "stripe" && e.external_event_id),
    (e) => e.external_event_id ?? "",
  );
  const outboxByDedupe = groupBy(input.syncOutbox, (o) => o.dedupe_key);
  const paymentsByIntent = groupBy(input.payments, (p) => p.stripe_payment_intent_id);

  const rows = input.payments
    .map((payment) => {
      const program = programById.get(payment.program_id);
      const enrollment = payment.enrollment_id ? enrollmentById.get(payment.enrollment_id) : undefined;
      const eventId = payment.stripe_event_id;
      const processedRows = eventId ? processedByEvent.get(eventId) ?? [] : [];
      const eventLogs = eventId ? logsByEvent.get(eventId) ?? [] : [];
      const processedLogDeliveries = eventLogs.filter((e) => e.processed_at).length;
      const processedDeliveries =
        processedLogDeliveries > 0 ? processedLogDeliveries : processedRows.length > 0 ? 1 : 0;
      const deliveries = Math.max(eventLogs.length, processedDeliveries);
      const duplicateDeliveries = Math.max(0, deliveries - processedDeliveries);
      const intentRows = paymentsByIntent.get(payment.stripe_payment_intent_id) ?? [];
      const visibleProgramKeys = unique(
        intentRows.map((p) => programById.get(p.program_id)?.key ?? p.program_key).filter(isPresent),
      );
      const outboxDedupeKey = eventId ? `stripe:${eventId}` : null;
      const outbox = outboxDedupeKey ? outboxByDedupe.get(outboxDedupeKey)?.[0] : undefined;
      const contaminationStatus: ContaminationStatus =
        visibleProgramKeys.length === 1 && (!enrollment || enrollment.program_id === payment.program_id)
          ? "isolated"
          : "contaminated";

      return {
        paymentId: payment.id,
        eventId,
        eventStatus: processedRows.length > 0 ? eventResultStatus(processedRows[0]) : "missing-ledger",
        intentId: payment.stripe_payment_intent_id,
        programId: payment.program_id,
        programKey: program?.key ?? payment.program_key,
        programName: program?.name ?? payment.program_name ?? payment.program_key,
        familyId: payment.family_id,
        enrollmentId: payment.enrollment_id,
        enrollmentStage: enrollment?.stage ?? null,
        enrollmentPaid: enrollment?.paid ?? null,
        hubspotDealId: enrollment?.hubspot_deal_id ?? null,
        amount: payment.amount,
        paymentStatus: payment.status,
        statusRank: payment.status_rank,
        occurredAt: payment.occurred_at,
        createdAt: payment.created_at,
        deliveries,
        processedDeliveries,
        duplicateDeliveries,
        processedLedgerRows: processedRows.length,
        paymentRowsForIntent: intentRows.length,
        idempotentReplayVisible:
          deliveries > 1 &&
          duplicateDeliveries > 0 &&
          processedRows.length <= 1 &&
          intentRows.length === 1,
        visibleProgramKeys,
        contaminationStatus,
        crmSyncStatus: crmSyncStatus(payment, enrollment, outbox, input.source),
        outboxDedupeKey,
        outboxStatus: outbox?.status ?? null,
      } satisfies PaymentWatchRow;
    })
    // Sort by created_at (when the row was actually RECORDED) descending — not occurred_at,
    // which the seed future-dates across the sprint (Jul/Aug), burying genuinely-recent
    // payments. created_at puts the just-made payments at the top, where you expect them.
    .sort((a, b) => timeValue(b.createdAt ?? b.occurredAt) - timeValue(a.createdAt ?? a.occurredAt));

  const duplicateRow = rows.find((row) => row.idempotentReplayVisible);
  const selected =
    duplicateRow ??
    rows.find((row) => row.paymentStatus === "succeeded" && row.eventStatus !== "missing-ledger") ??
    rows[0] ??
    null;

  const idempotency = buildIdempotencySignal(selected, rows);
  const contamination = buildContaminationSignal(input, programById, enrollmentById);
  const programs = buildProgramSummaries(input, rows);

  const signals: PaymentPropagationSignals = {
    processedEventStatusVisible: rows.some((row) => row.eventStatus !== "missing-ledger"),
    paymentStatusVisible: rows.some((row) => Boolean(row.paymentStatus)),
    programIsolationVisible:
      input.programs.length > 1 &&
      contamination.noContamination &&
      rows.some((row) => row.visibleProgramKeys.length === 1),
    idempotentReplayVisible: idempotency.replayNoOpVisible,
    contaminationSignalVisible:
      contamination.noContamination ||
      contamination.crossProgramEnrollmentMismatches.length > 0 ||
      contamination.crossProgramIntentContamination.length > 0,
    demoPathAvailable: true,
  };

  return {
    source: input.source,
    sourceLabel:
      input.source === "live-db" ? input.sourceLabel ?? "Live DB" : "Deterministic seed fixture",
    generatedAt: input.generatedAt,
    programs,
    rows,
    selected,
    idempotency,
    contamination,
    signals,
    demoPath: [
      "Open /dev/payments as the Admin demo user.",
      "Check the source badge: live-db when APP_RW_DATABASE_URL is reachable, otherwise deterministic seed fallback.",
      "Read the highlighted Stripe event across ledger, payment row, enrollment, HubSpot handoff, and isolation checks.",
      "Replay the same signed event in the live path with npm test -- tests/payments.test.ts; reload and confirm one ledger row, one payment row, and a duplicate/no-op delivery.",
    ],
    liveLimitations: input.liveLimitations ?? [],
  };
}

function buildProgramSummaries(
  input: PaymentPropagationInput,
  rows: PaymentWatchRow[],
): ProgramPaymentSummary[] {
  return input.programs.map((program) => {
    const programRows = rows.filter((row) => row.programId === program.id);
    return {
      programId: program.id,
      programKey: program.key,
      programName: program.name,
      paymentCount: programRows.length,
      processedEventCount: programRows.filter((row) => row.eventStatus !== "missing-ledger").length,
      succeededCount: programRows.filter((row) => row.paymentStatus === "succeeded").length,
      failedCount: programRows.filter((row) => row.paymentStatus === "failed").length,
      refundedCount: programRows.filter((row) => row.paymentStatus === "refunded").length,
      amount: programRows
        .filter((row) => row.paymentStatus === "succeeded" || row.paymentStatus === "refunded")
        .reduce((sum, row) => sum + row.amount, 0),
    };
  });
}

function buildIdempotencySignal(
  selected: PaymentWatchRow | null,
  rows: PaymentWatchRow[],
): IdempotencySignal {
  const row = rows.find((r) => r.idempotentReplayVisible) ?? selected;
  return {
    eventId: row?.eventId ?? null,
    intentId: row?.intentId ?? null,
    deliveries: row?.deliveries ?? 0,
    processedDeliveries: row?.processedDeliveries ?? 0,
    duplicateDeliveries: row?.duplicateDeliveries ?? 0,
    processedLedgerRows: row?.processedLedgerRows ?? 0,
    paymentRowsForIntent: row?.paymentRowsForIntent ?? 0,
    replayNoOpVisible: row?.idempotentReplayVisible ?? false,
    row,
  };
}

function buildContaminationSignal(
  input: PaymentPropagationInput,
  programById: Map<string, Program>,
  enrollmentById: Map<string, EnrollmentFact>,
): ContaminationSignal {
  const crossProgramEnrollmentMismatches = input.payments.flatMap((payment) => {
    if (!payment.enrollment_id) return [];
    const enrollment = enrollmentById.get(payment.enrollment_id);
    if (!enrollment || enrollment.program_id === payment.program_id) return [];
    return [
      {
        paymentId: payment.id,
        paymentProgramKey: programById.get(payment.program_id)?.key ?? payment.program_key,
        enrollmentProgramKey: programById.get(enrollment.program_id)?.key ?? enrollment.program_key,
      },
    ];
  });

  const intents = groupBy(input.payments, (p) => p.stripe_payment_intent_id);
  const crossProgramIntentContamination = [...intents.entries()].flatMap(([intentId, payments]) => {
    const programKeys = unique(
      payments.map((p) => programById.get(p.program_id)?.key ?? p.program_key).filter(isPresent),
    );
    return programKeys.length > 1 ? [{ intentId, programKeys }] : [];
  });

  const familyPrograms = new Map<string, Set<string>>();
  for (const enrollment of input.enrollments) {
    const current = familyPrograms.get(enrollment.family_id) ?? new Set<string>();
    current.add(enrollment.program_id);
    familyPrograms.set(enrollment.family_id, current);
  }

  return {
    noContamination:
      crossProgramEnrollmentMismatches.length === 0 &&
      crossProgramIntentContamination.length === 0,
    crossProgramEnrollmentMismatches,
    crossProgramIntentContamination,
    familiesInMultiplePrograms: [...familyPrograms.values()].filter((programs) => programs.size > 1)
      .length,
    isolatedPaymentRows: input.payments.length - crossProgramEnrollmentMismatches.length,
  };
}

function eventResultStatus(event: ProcessedEvent): string {
  const result = event.result ?? {};
  for (const key of ["status", "payment_status", "paymentStatus"]) {
    const value = result[key];
    if (typeof value === "string") return value;
  }
  return "processed";
}

function crmSyncStatus(
  payment: PaymentFact,
  enrollment: EnrollmentFact | undefined,
  outbox: SyncOutboxEntry | undefined,
  source: PaymentWatcherSource,
): CrmSyncStatus {
  if (outbox?.status === "done") return "done";
  if (outbox?.status === "dead") return "dead";
  if (outbox) return "queued";
  if (payment.status !== "succeeded") return "not-applicable";
  if (!enrollment?.hubspot_deal_id) return "not-applicable";
  return source === "seed-fixture" ? "seed-implied" : "missing";
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function timeValue(value: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}
