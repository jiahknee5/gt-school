// rbac.ts — Summer Camp access. The roster carries minors' PII, so it is gated to the
// camp Operator (Content Owner) + Leader + Admin; a non-camp Operator is DENIED (invariant
// #8, Schwartz "don't ship"). Operators may SUBMIT to the Decision Queue but not view/act
// on the full queue.

import type { Role } from "@/lib/phase2";

export function canViewRoster(role: Role | null | undefined, isCampOwner = true): boolean {
  if (role === "admin" || role === "leader") return true;
  if (role === "operator") return isCampOwner; // only the camp Operator
  return false;
}

export function canSetTarget(role: Role | null | undefined): boolean {
  return role === "leader";
}

export function canViewDecisionQueue(role: Role | null | undefined): boolean {
  return role === "leader";
}

export function canSubmitDecision(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader" || role === "operator";
}

export class CampAuthError extends Error {
  constructor(action: string) {
    super(`forbidden: ${action} is gated (minors' PII / RBAC)`);
    this.name = "CampAuthError";
  }
}

export function assertCanViewRoster(role: Role | null | undefined, isCampOwner = true): void {
  if (!canViewRoster(role, isCampOwner)) throw new CampAuthError("roster view");
}

/** Minimal roster fields only — never the full child record. */
export interface RosterEntry {
  childInitial: string;
  campusName: string;
  weeks: number;
  attended: boolean;
}

export function maskName(name: string): string {
  return `${name.trim().charAt(0).toUpperCase()}.`;
}
