/**
 * queue.ts — the data-quality queue view + RBAC for write-through actions (§7e).
 *
 * Lists `data_quality_issue` rows (seeded/system + auto-detected) grouped by status,
 * severity, and category, with a DERIVED owner (A5: `data_quality_issue` has no owner
 * column, so owner is computed, not stored). Ack/prioritize/resolve are Admin/Leader
 * only — Operators are denied (Schwartz #8); the assert helper is the server-side guard
 * a write route calls before mutating.
 */

import type { Role } from "../phase2";
import type { DataQualityIssue } from "../seed/types";
import { asIssueRow, type DetectedIssue } from "./detect";

export type QueueAction = "ack" | "prioritize" | "resolve";

export interface QueueItem extends DataQualityIssue {
  owner: string;
  autoDetected: boolean;
}

export const SEVERITY_RANK: Record<string, number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** An auto-detected row carries the detector's full signature (entity + entity_id + field). */
export function isAutoDetected(issue: Pick<DataQualityIssue, "entity" | "entity_id" | "field">): boolean {
  return issue.entity != null && issue.entity_id != null && issue.field != null;
}

/** Owner is derived (A5): auto-detected → Marketing Lead; manual/system → Marketing Lead (the module owner). */
export function ownerForIssue(issue: DataQualityIssue): string {
  return isAutoDetected(issue) ? "Marketing Lead (auto-detected)" : "Marketing Lead";
}

function toItem(issue: DataQualityIssue): QueueItem {
  return { ...issue, owner: ownerForIssue(issue), autoDetected: isAutoDetected(issue) };
}

export interface QueueView {
  open: QueueItem[]; // sorted by severity then created_at desc
  resolved: QueueItem[]; // resolution log
  openCount: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

/**
 * Build the queue from the issues on record, optionally merging in freshly-detected
 * issues that aren't yet persisted (so the queue shows what the detector found without
 * a DB write). Merge is idempotent by signature.
 */
export function buildQueue(
  issues: DataQualityIssue[],
  detected: DetectedIssue[] = [],
  detectedCreatedAt = "2026-08-31T00:00:00.000Z",
): QueueView {
  const seen = new Set(
    issues
      .filter(isAutoDetected)
      .map((i) => `${i.category}|${i.entity}|${i.entity_id}|${i.field}`),
  );
  const merged: DataQualityIssue[] = [...issues];
  for (const d of detected) {
    const key = `${d.category}|${d.entity}|${d.entity_id}|${d.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(asIssueRow(d, detectedCreatedAt));
  }

  const items = merged.map(toItem);
  const open = items
    .filter((i) => i.status === "open")
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
        b.created_at.localeCompare(a.created_at),
    );
  const resolved = items
    .filter((i) => i.status === "resolved")
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const i of open) {
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  }

  return { open, resolved, openCount: open.length, bySeverity, byCategory };
}

/** Read access: Admin (Marketing Lead) + Leader. Operators are denied (PRD §3 Module 7). */
export function canViewCrmOps(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader";
}

/** Write access (ack/prioritize/resolve): same gate — Admin/Leader only. */
export function canActOnQueue(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader";
}

export class QueueAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "QueueAuthError";
  }
}

/** Server-side guard a write route MUST call before mutating a queue item. */
export function assertCanAct(role: Role | null | undefined, action: QueueAction): void {
  if (role == null) throw new QueueAuthError(401, "Authentication required.");
  if (!canActOnQueue(role)) {
    throw new QueueAuthError(403, `CRM Ops is Admin/Leader only; Operators cannot ${action} data-quality issues.`);
  }
}
