// Global "active program" view lens for the marketing hub UI.
//
// The app has exactly TWO isolated programs (lib/auth/program.ts):
//   fall_enrollment  — GT Anywhere fall enrollment (the $365K marketing budget)
//   summer_camp      — Summer Camp (a SEPARATE P&L; does NOT roll into the $365K)
//
// This module is the *view* analog of lib/nav.ts (the My/All nav scope). It picks
// which program's data the UI requests. It is a SOFT lens, NOT an access gate:
//   - "all" is a leadership all-up view, available only to roles allowed in more
//     than one program (admin/leader). It is NOT a ProgramKey and is NEVER passed
//     to withProgram(); it expands to the role's allowed program set.
//   - RBAC stays authoritative: every selectable scope is validated against
//     allowedPrograms(role). Operators (fall_enrollment only) are locked to Fall —
//     they can never select summer_camp or "all".

import { allowedPrograms, type ProgramKey } from "@/lib/auth/program";
import type { Role } from "@/lib/phase2";

/** A program view lens: one concrete program, or the all-up leadership view. */
export type ProgramScope = ProgramKey | "all";

export const PROGRAM_SCOPES: ProgramScope[] = ["fall_enrollment", "summer_camp", "all"];

export const PROGRAM_SCOPE_LABELS: Record<ProgramScope, string> = {
  fall_enrollment: "Fall enrollment",
  summer_camp: "Summer Camp",
  all: "All programs",
};

/** Compact labels for the segmented sidebar control. */
export const PROGRAM_SCOPE_SHORT: Record<ProgramScope, string> = {
  fall_enrollment: "Fall",
  summer_camp: "Camp",
  all: "All",
};

export function isProgramScope(value: unknown): value is ProgramScope {
  return value === "fall_enrollment" || value === "summer_camp" || value === "all";
}

/**
 * Parse a stored / submitted scope value, tolerating brand aliases and legacy
 * spellings so existing prefs keep working instead of erroring:
 *   - "gt_anywhere" / "anywhere" / "fall" → fall_enrollment (GT Anywhere == fall)
 *   - "summer" / "camp"                   → summer_camp
 *   - "both"                              → all
 * Returns null for anything unrecognized.
 */
export function parseProgramScope(value: unknown): ProgramScope | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "gt_anywhere" || normalized === "anywhere" || normalized === "fall") {
    return "fall_enrollment";
  }
  if (normalized === "summer" || normalized === "camp") return "summer_camp";
  if (normalized === "both") return "all";
  return isProgramScope(normalized) ? normalized : null;
}

/**
 * View scopes a role may CHOOSE. Single-program roles (operators) are locked to
 * their one program — no "all". Multi-program roles (admin/leader) also get the
 * "all" all-up view. The returned list is exactly the set the UI may render and
 * the API may accept.
 */
export function programScopesForRole(role: Role): ProgramScope[] {
  const allowed = allowedPrograms(role);
  if (allowed.length <= 1) return [...allowed];
  return [...allowed, "all"];
}

/** Default scope for a role: its primary (first allowed) program. */
export function defaultProgramScope(role: Role): ProgramScope {
  return allowedPrograms(role)[0];
}

/**
 * Clamp a requested/stored scope to one the role may actually use (RBAC). Falls
 * back to the role default for missing / invalid / disallowed values. The result
 * is GUARANTEED to be a member of programScopesForRole(role) — a client can never
 * widen its view past its allowed programs through this function.
 */
export function resolveViewerProgramScope(role: Role, requested: unknown): ProgramScope {
  const parsed = parseProgramScope(requested);
  if (!parsed) return defaultProgramScope(role);
  return programScopesForRole(role).includes(parsed) ? parsed : defaultProgramScope(role);
}

/**
 * The concrete ProgramKey set a scope expands to — i.e. which program(s) to query
 * or show. "all" expands to the role's allowed programs; a single program returns
 * just itself. This is the bridge between the UI lens and withProgram() scoping:
 * callers iterate the returned keys, each a valid RLS scope for the session role.
 */
export function programsForScope(role: Role, scope: ProgramScope): ProgramKey[] {
  if (scope === "all") return allowedPrograms(role);
  return [scope];
}
