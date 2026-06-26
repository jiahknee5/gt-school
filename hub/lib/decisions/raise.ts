// Pure, dependency-free builder + demo-store codec for the "raise a decision" flow
// (the SUBMIT half of Module 11 — PRD §2 "Any team member can submit… from their own
// module"). No DB, no next/headers — so the route handler can compose it and unit tests
// can assert exactly what gets created, without a live DB.
//
// Round-trip on the seed-only demo: a raised decision is appended to a per-user signed
// cookie that the "My submissions" page also reads, so submit → appears-in-my-list works
// after a router.refresh() with no provisioned Postgres (the live path additionally
// inserts into the `decisions` table when APP_RW_DATABASE_URL is configured).

import type { Decision } from "@/lib/seed/types";

export const RAISED_COOKIE = "gt_raised";
/** Keep the cookie small + bounded — a user only needs to see their recent raises. */
export const RAISED_CAP = 12;
const QUESTION_MAX = 280;
const TEXT_MAX = 600;

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type RaisePriority = (typeof PRIORITIES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class RaiseDecisionError extends Error {
  status: 400;
  constructor(message: string) {
    super(message);
    this.status = 400;
    this.name = "RaiseDecisionError";
  }
}

export interface RaiseDecisionInput {
  question?: unknown;
  recommendation?: unknown;
  workstream?: unknown;
  budget_ask?: unknown;
  priority?: unknown;
  due_date?: unknown;
}

export interface RaiseSubmitter {
  id: string;
  name?: string | null;
  title: string;
}

/** A decision raised in the demo, tagged with the submitter id so a read can scope to "mine". */
export type StoredRaise = Decision & { submitter_id: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown, max: number, field: string): string | null {
  const text = str(value);
  if (!text) return null;
  if (text.length > max) {
    throw new RaiseDecisionError(`${field} must be ${max} characters or fewer.`);
  }
  return text;
}

function normalizePriority(value: unknown): RaisePriority {
  const raw = str(value).toLowerCase();
  if (!raw) return "normal";
  return (PRIORITIES as readonly string[]).includes(raw) ? (raw as RaisePriority) : "normal";
}

function parseBudgetAsk(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) {
    throw new RaiseDecisionError("Budget ask must be a number.");
  }
  if (n < 0) {
    throw new RaiseDecisionError("Budget ask cannot be negative.");
  }
  return Math.round(n);
}

function parseDueDate(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(text))) {
    throw new RaiseDecisionError("Due date must be a valid YYYY-MM-DD date.");
  }
  return text;
}

/**
 * Validate + construct a freshly-raised, OPEN decision attributed to the submitter.
 * Throws RaiseDecisionError(400) on bad input (empty question, bad number/date).
 * `opts.id` / `opts.now` are injectable for deterministic tests.
 */
export function buildRaisedDecision(
  input: RaiseDecisionInput,
  submitter: RaiseSubmitter,
  opts: { id?: string; now?: Date } = {},
): StoredRaise {
  if (!submitter?.id || !submitter?.title) {
    throw new RaiseDecisionError("A signed-in submitter is required to raise a decision.");
  }
  const question = str(input.question);
  if (!question) {
    throw new RaiseDecisionError("A decision needs a question for leadership to rule on.");
  }
  if (question.length > QUESTION_MAX) {
    throw new RaiseDecisionError(`The question must be ${QUESTION_MAX} characters or fewer.`);
  }

  const now = opts.now ?? new Date();
  const id = opts.id ?? globalThis.crypto.randomUUID();

  return {
    id,
    question,
    raised_by: submitter.title,
    workstream: optionalText(input.workstream, 80, "Workstream"),
    recommendation: optionalText(input.recommendation, TEXT_MAX, "Recommendation"),
    budget_ask: parseBudgetAsk(input.budget_ask),
    due_date: parseDueDate(input.due_date),
    priority: normalizePriority(input.priority),
    status: "open",
    response: null,
    response_note: null,
    auto_flag: false,
    resolved_at: null,
    created_at: now.toISOString(),
    submitter_id: submitter.id,
  };
}

/** Drop the submitter tag so the stored raise can be read as a plain Decision. */
export function storedToDecision(raise: StoredRaise): Decision {
  const { submitter_id: _submitterId, ...decision } = raise;
  return decision;
}

/** Encode raises for the cookie. base64 of JSON — compact + transport-safe. */
export function encodeRaises(raises: StoredRaise[]): string {
  const json = JSON.stringify(raises.slice(-RAISED_CAP));
  return Buffer.from(json, "utf8").toString("base64");
}

/** Decode the cookie value back to raises; returns [] on any malformed/missing value. */
export function decodeRaises(value: string | null | undefined): StoredRaise[] {
  if (!value) return [];
  try {
    const json = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is StoredRaise =>
        Boolean(r) && typeof r.id === "string" && typeof r.question === "string" && typeof r.submitter_id === "string",
    );
  } catch {
    return [];
  }
}

/** Append a new raise to the existing list, newest last, bounded to RAISED_CAP. */
export function appendRaise(existing: StoredRaise[], raise: StoredRaise): StoredRaise[] {
  return [...existing, raise].slice(-RAISED_CAP);
}

/** The current user's own raised decisions (newest first), decoded from the cookie. */
export function ownRaises(cookieValue: string | null | undefined, submitterId: string): Decision[] {
  return decodeRaises(cookieValue)
    .filter((r) => r.submitter_id === submitterId)
    .map(storedToDecision)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
