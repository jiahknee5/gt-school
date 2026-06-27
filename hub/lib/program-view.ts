// Server helper: resolve the viewer's ACTIVE program lens for a page, the documented
// read-boundary pattern for the global program selector:
//
//   getProgramScopeForUser(session.id)  → the stored UI preference (or null)
//   resolveViewerProgramScope(role, …)  → RBAC-clamped scope (never widens past role)
//   programsForScope(role, scope)        → the concrete ProgramKey set to show/query
//
// This is a SOFT view lens, not an access gate: it only decides which program's data a
// page surfaces. RLS stays authoritative server-side (lib/db.ts withProgram()); the
// programs returned here are exactly the role's allowed set, so a page can iterate them
// safely. Pages call this once and branch on showFall / showCamp.

import type { ProgramKey } from "@/lib/auth/program";
import type { Role } from "@/lib/phase2";
import { getProgramScopeForUser } from "@/lib/program-preference";
import {
  programsForScope,
  resolveViewerProgramScope,
  type ProgramScope,
} from "@/lib/program-scope";

export type ProgramView = {
  /** The RBAC-clamped active scope (fall_enrollment | summer_camp | all). */
  scope: ProgramScope;
  /** Concrete program(s) the scope expands to — the set a page should show. */
  programs: ProgramKey[];
  /** Convenience flags so pages stay surgical. */
  showFall: boolean;
  showCamp: boolean;
};

/**
 * Resolve the active program view for the current request. Pass the SESSION user id
 * (so the stored preference is read) and the SESSION role (so RBAC clamps the scope).
 * With no userId (demo / no session) the stored preference is skipped and the role
 * default applies — identical to how nav scope degrades.
 */
export async function resolveProgramView(opts: {
  userId?: string | null;
  role: Role;
}): Promise<ProgramView> {
  const stored = opts.userId ? await getProgramScopeForUser(opts.userId) : null;
  const scope = resolveViewerProgramScope(opts.role, stored);
  const programs = programsForScope(opts.role, scope);
  return {
    scope,
    programs,
    showFall: programs.includes("fall_enrollment"),
    showCamp: programs.includes("summer_camp"),
  };
}
