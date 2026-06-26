/**
 * rbac.ts — per-owner write scoping for the Budget Tracker (Module 10, PLAN §3/§6.5).
 *
 * The rule (PRD §3 Module 10 roles):
 *   - Operator edits ONLY their own workstream row's spend (budget_entry).
 *   - Leader edits `planned` + approves reallocation (but NOT another owner's actual).
 *   - Admin (Marketing Lead) edits all.
 *   - everyone else read-only.
 *
 * Ownership of a workstream is read from `DemoUser.owns` (lib/phase2.ts) — never a
 * hardcoded list — so "who can write which row" is data, not code. This module is the
 * server-side guard a write route MUST call before appending a ledger row; the UI
 * mirrors it visibly (own row editable, others greyed) but the server is authoritative.
 */

import { canEditBudgetWorkstream, type DemoUser, type Role } from "@/lib/phase2";

export type WorkstreamKey = "grassroots" | "thought_leadership" | "guerrilla" | "foundations";

/** The function owner responsible for each workstream (display + audit `owner_role`). */
export const WORKSTREAM_OWNER_ROLE: Record<string, string> = {
  grassroots: "Grassroots Owner",
  thought_leadership: "Content Owner",
  guerrilla: "Leadership",
  foundations: "Marketing Lead",
};

export function ownerRoleFor(key: string): string {
  return WORKSTREAM_OWNER_ROLE[key] ?? "Marketing Lead";
}

export class BudgetAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "BudgetAuthError";
  }
}

/** Can this user append a spend entry (committed/actual) for this workstream? */
export function canWriteEntry(user: DemoUser | null | undefined, key: string): boolean {
  if (!user) return false;
  return canEditBudgetWorkstream(user, key);
}

/** Server-side guard a budget-entry write route MUST call before appending a row. */
export function assertCanWriteEntry(user: DemoUser | null | undefined, key: string): void {
  if (!user) throw new BudgetAuthError(401, "Authentication required.");
  if (!canWriteEntry(user, key)) {
    throw new BudgetAuthError(
      403,
      `Budget entries for "${key}" are owned by ${ownerRoleFor(key)}; ${user.title} (${user.role}) may not write this row.`,
    );
  }
}

/** Leadership-only: editing `planned` and approving a reallocation. Accepts a user or role. */
export function canEditPlanned(actor: DemoUser | Role | null | undefined): boolean {
  const role = typeof actor === "string" || actor == null ? actor : actor.role;
  return role === "admin" || role === "leader";
}

export function assertCanEditPlanned(actor: DemoUser | Role | null | undefined): void {
  const role = typeof actor === "string" || actor == null ? actor : actor.role;
  if (role == null) throw new BudgetAuthError(401, "Authentication required.");
  if (!canEditPlanned(role)) {
    throw new BudgetAuthError(403, "Editing planned amounts / approving reallocation is Leadership only.");
  }
}
