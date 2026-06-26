// rbac.ts — the nurture access model, server-enforceable + pure for tests.
//
// Operator is read-only. SMS PII (raw phone / message body) is gated to Admin/Leader;
// everyone else sees a MASKED phone and no body (invariant #8, Elena Schwartz "don't
// ship"). Acting on a hot-family Decision is Leader-only (invariant #11). Writing a
// segment is Admin-only.

import type { Role } from "@/lib/phase2";

export function canViewSmsPii(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader";
}

export function canActHotFamily(role: Role | null | undefined): boolean {
  return role === "leader";
}

export function canWriteSegment(role: Role | null | undefined): boolean {
  return role === "admin";
}

export class NurtureAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "NurtureAuthError";
  }
}

export function assertCanActHotFamily(role: Role | null | undefined): void {
  if (!role) throw new NurtureAuthError(401, "Authentication required.");
  if (!canActHotFamily(role)) throw new NurtureAuthError(403, "Only Leaders may act on a hot-family decision.");
}

/** Mask a phone for non-PII roles: keep the last 4 digits only. */
export function maskPhone(phone: string | null): string {
  if (!phone) return "(no phone)";
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `(***) ***-${last4 || "****"}`;
}
