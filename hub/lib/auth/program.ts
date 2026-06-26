// Program (tenant) scope derivation. SECURITY (finding S2): the program id passed to
// withProgram() — the RLS scope — must ALWAYS derive from the authenticated session,
// NEVER from a client-supplied value. A client may *request* a program (e.g. a UI
// program switcher), but the request is validated against the session role's allowed
// set and rejected otherwise. This is the app-layer guard that backs the DB's
// fail-closed RLS in lib/db.ts (which is intentionally left untouched).

import type { Role } from "@/lib/phase2";

export type ProgramKey = "fall_enrollment" | "summer_camp";

export const ALL_PROGRAMS: ProgramKey[] = ["fall_enrollment", "summer_camp"];

/**
 * Programs a role may operate within. Dev defaults until a real org→program mapping
 * lands: leadership/admin span both programs; operators are scoped to the primary
 * fall enrollment program. Tightening this later does not change call sites.
 */
export function allowedPrograms(role: Role): ProgramKey[] {
  if (role === "admin" || role === "leader") return [...ALL_PROGRAMS];
  return ["fall_enrollment"];
}

export class ProgramScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgramScopeError";
  }
}

/**
 * Resolve the program scope for a request. Pass the role from the SESSION and,
 * optionally, the program the client asked for. Throws ProgramScopeError if the
 * client asks for a program outside the session's allowed set (forged/IDOR attempt).
 * With no request, defaults to the role's primary program.
 */
export function resolveProgramScope(input: {
  role: Role;
  requestedProgram?: string | null;
}): ProgramKey {
  const allowed = allowedPrograms(input.role);
  const requested = input.requestedProgram?.trim();
  if (!requested) return allowed[0];
  if (!(allowed as string[]).includes(requested)) {
    throw new ProgramScopeError(
      `Program scope violation: role "${input.role}" may not access program "${requested}".`,
    );
  }
  return requested as ProgramKey;
}
