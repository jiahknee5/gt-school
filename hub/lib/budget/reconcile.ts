import type { BudgetEntry, BudgetWorkstream } from "@/lib/seed/types";
import { BUDGET_TOTAL } from "@/lib/seed/dictionaries";
import {
  DEMO_USERS,
  canEditBudgetWorkstream,
  type BudgetRow,
  type BudgetSummary,
  type DemoUser,
} from "@/lib/phase2";

export type BudgetEntryKind = BudgetEntry["kind"];
export type BudgetEntryOrigin = BudgetEntry["origin"];

export type BudgetEntryInput = {
  workstream_key: string;
  kind: string | null | undefined;
  origin?: string | null | undefined;
  amount: number | string | null | undefined;
  entered_by?: string | null | undefined;
  owner_role: string;
  note?: string | null | undefined;
  campaign_key?: string | null | undefined;
};

export interface ReconciledBudgetRow extends BudgetRow {
  available: number;
  campaignActual: number;
  manualActual: number;
  lastEdit: BudgetEntry | null;
  sourceCommitted: number;
  sourceActual: number;
  aggregateMatches: boolean;
}

export type BudgetReconciliationTotals = BudgetSummary["totals"] & {
  available: number;
};

export interface Reconciliation extends Omit<BudgetSummary, "rows" | "autoFlagRows" | "totals"> {
  rows: ReconciledBudgetRow[];
  totals: BudgetReconciliationTotals;
  autoFlagRows: ReconciledBudgetRow[];
  reconciles: boolean;
  reconcileError: string | null;
  doubleCountedCampaigns: string[];
  unattributedCampaignKeys: string[];
  aggregateMismatches: string[];
}

export class BudgetValidationError extends Error {
  status: 400;

  constructor(message: string) {
    super(message);
    this.status = 400;
    this.name = "BudgetValidationError";
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function normalizeBudgetEntryInput(input: BudgetEntryInput) {
  const workstreamKey = String(input.workstream_key ?? "").trim();
  const kind = String(input.kind ?? "").trim();
  const origin = String(input.origin ?? "manual").trim();
  const amount = Number(input.amount);
  const ownerRole = String(input.owner_role ?? "").trim();
  const enteredBy = String(input.entered_by ?? "").trim();
  const note = input.note == null ? null : String(input.note).trim() || null;
  const campaignKey =
    input.campaign_key == null ? null : String(input.campaign_key).trim() || null;

  if (!workstreamKey) throw new BudgetValidationError("Budget entry requires a workstream.");
  if (kind !== "committed" && kind !== "actual") {
    throw new BudgetValidationError("Budget entry kind must be committed or actual.");
  }
  if (origin !== "manual" && origin !== "campaign") {
    throw new BudgetValidationError("Budget entry origin must be manual or campaign.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BudgetValidationError("Budget entry amount must be a positive number.");
  }
  if (!ownerRole) throw new BudgetValidationError("Budget entry requires an owner role.");
  if (!enteredBy) throw new BudgetValidationError("Budget entry requires an entered_by value.");
  if (origin === "campaign" && !campaignKey) {
    throw new BudgetValidationError("Campaign budget entries require a campaign_key.");
  }
  if (origin === "manual" && campaignKey) {
    throw new BudgetValidationError("Manual budget entries cannot carry a campaign_key.");
  }

  return {
    workstream_key: workstreamKey,
    kind: kind as BudgetEntryKind,
    origin: origin as BudgetEntryOrigin,
    amount: round2(amount),
    entered_by: enteredBy,
    owner_role: ownerRole,
    note,
    campaign_key: campaignKey,
  };
}

function byWorkstream(entries: BudgetEntry[]) {
  const byKey = new Map<string, BudgetEntry[]>();
  for (const entry of entries) {
    const rows = byKey.get(entry.workstream_key) ?? [];
    rows.push(entry);
    byKey.set(entry.workstream_key, rows);
  }
  return byKey;
}

function latest(entries: BudgetEntry[]): BudgetEntry | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function doubleCountedCampaigns(entries: BudgetEntry[]): string[] {
  const campaignKeys = new Set(
    entries
      .filter((entry) => entry.origin === "campaign" && entry.campaign_key)
      .map((entry) => entry.campaign_key!),
  );
  const manualKeys = new Set(
    entries
      .filter((entry) => entry.origin === "manual" && entry.campaign_key)
      .map((entry) => entry.campaign_key!),
  );
  return [...campaignKeys].filter((key) => manualKeys.has(key)).sort();
}

export function assertReconciles(workstreams: BudgetWorkstream[]): void {
  const recommended = round2(workstreams.reduce((sum, row) => sum + row.recommended, 0));
  const planned = round2(workstreams.reduce((sum, row) => sum + row.planned, 0));
  if (recommended !== BUDGET_TOTAL) {
    throw new BudgetValidationError(`Recommended budget must sum to ${BUDGET_TOTAL}.`);
  }
  if (planned !== BUDGET_TOTAL) {
    throw new BudgetValidationError(`Planned budget must sum to ${BUDGET_TOTAL}.`);
  }
}

export function reconcileBudget(
  workstreams: BudgetWorkstream[],
  entries: BudgetEntry[],
  users: DemoUser[] = DEMO_USERS,
): Reconciliation {
  const entriesByWorkstream = byWorkstream(entries);
  const rows = workstreams.map((workstream) => {
    const ledger = entriesByWorkstream.get(workstream.key) ?? [];
    const committed = round2(
      ledger.filter((entry) => entry.kind === "committed").reduce((sum, entry) => sum + entry.amount, 0),
    );
    const actualEntries = ledger.filter((entry) => entry.kind === "actual");
    const actual = round2(actualEntries.reduce((sum, entry) => sum + entry.amount, 0));
    const campaignActual = round2(
      actualEntries
        .filter((entry) => entry.origin === "campaign")
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const manualActual = round2(actual - campaignActual);
    const variancePct = workstream.planned === 0
      ? 0
      : ((actual - workstream.planned) / workstream.planned) * 100;
    const overAmount = actual - workstream.planned;
    const aggregateMatches =
      committed === round2(workstream.committed) && actual === round2(workstream.actual);

    return {
      ...workstream,
      committed,
      actual,
      sourceCommitted: round2(workstream.committed),
      sourceActual: round2(workstream.actual),
      remaining: round2(workstream.planned - actual),
      available: round2(workstream.planned - committed),
      variancePct,
      health:
        variancePct > 10 && overAmount >= 2500
          ? "at-risk"
          : overAmount > 0
            ? "watch"
            : "on-track",
      editableBy: users
        .filter((user) => canEditBudgetWorkstream(user, workstream.key))
        .map((user) => user.id),
      campaignActual,
      manualActual,
      lastEdit: latest(ledger),
      aggregateMatches,
    } satisfies ReconciledBudgetRow;
  });

  const totals = rows.reduce(
    (acc, row) => ({
      recommended: round2(acc.recommended + row.recommended),
      planned: round2(acc.planned + row.planned),
      committed: round2(acc.committed + row.committed),
      actual: round2(acc.actual + row.actual),
      remaining: round2(acc.remaining + row.remaining),
      available: round2(acc.available + row.available),
    }),
    { recommended: 0, planned: 0, committed: 0, actual: 0, remaining: 0, available: 0 },
  );

  const doubleCounted = doubleCountedCampaigns(entries);
  const unattributedCampaignKeys = entries
    .filter((entry) => entry.origin === "campaign" && !entry.campaign_key)
    .map((entry) => entry.id)
    .sort();
  const aggregateMismatches = rows
    .filter((row) => !row.aggregateMatches)
    .map((row) => row.key);
  const errors: string[] = [];
  if (totals.recommended !== BUDGET_TOTAL) {
    errors.push(`recommended total is ${totals.recommended}, expected ${BUDGET_TOTAL}`);
  }
  if (totals.planned !== BUDGET_TOTAL) {
    errors.push(`planned total is ${totals.planned}, expected ${BUDGET_TOTAL}`);
  }
  if (doubleCounted.length > 0) {
    errors.push(`double-counted campaigns: ${doubleCounted.join(", ")}`);
  }
  if (unattributedCampaignKeys.length > 0) {
    errors.push(`unattributed campaign entries: ${unattributedCampaignKeys.join(", ")}`);
  }

  const autoFlagRows = rows.filter(
    (row) => row.actual > row.planned * 1.1 && row.actual - row.planned >= 2500,
  );

  return {
    rows,
    totals,
    autoFlagRows,
    reconciles: errors.length === 0,
    reconcileError: errors.length ? errors.join("; ") : null,
    doubleCountedCampaigns: doubleCounted,
    unattributedCampaignKeys,
    aggregateMismatches,
  };
}

export function summarizeBudgetLedger(
  workstreams: BudgetWorkstream[],
  entries: BudgetEntry[],
  users: DemoUser[] = DEMO_USERS,
): BudgetSummary {
  return reconcileBudget(workstreams, entries, users);
}
