// Soft sidebar visibility — declutters the menu by functional role / nav scope.
// RBAC (middleware + leaderOnly) is the ONLY hard access gate; this module never
// blocks routes.

import { MODULES, modulesInAgendaOrder, type ModuleDef } from "@/lib/modules";
import type { FunctionalRole, Role } from "@/lib/phase2";

export type NavScope = "my" | "all" | "agenda";

export const NAV_SCOPES: NavScope[] = ["my", "all", "agenda"];

export const NAV_SCOPE_LABELS: Record<NavScope, string> = {
  my: "My modules",
  all: "All modules",
  agenda: "Meeting agenda",
};

/** Modules always shown in "My modules" scope regardless of ownership. */
export const ALWAYS_VISIBLE_MODULE_SLUGS = new Set(["home", "dashboard", "library"]);

export type NavViewer = {
  role: Role;
  functionalRoles: FunctionalRole[];
  ownsModules: string[];
};

export function isNavScope(value: unknown): value is NavScope {
  return value === "my" || value === "all" || value === "agenda";
}

export function parseNavScope(value: unknown): NavScope | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isNavScope(normalized) ? normalized : null;
}

/** Whether a module is "mine" for the viewer's functional roles / owned slugs. */
export function moduleMatchesViewer(module: ModuleDef, viewer: NavViewer): boolean {
  if (ALWAYS_VISIBLE_MODULE_SLUGS.has(module.slug)) return true;
  if (viewer.ownsModules.includes(module.slug)) return true;
  if (module.owners.includes("All")) return true;
  return module.owners.some((owner) =>
    viewer.functionalRoles.includes(owner as FunctionalRole),
  );
}

/** Agenda-ordered slugs for the meeting walkthrough lens. */
export function agendaModuleSlugs(): string[] {
  const slugs = modulesInAgendaOrder().map((m) => m.slug);
  if (!slugs.includes("home")) slugs.unshift("home");
  return slugs;
}

/**
 * Filter modules by nav scope after RBAC (leaderOnly) filtering is applied upstream.
 */
export function modulesForNavScope(
  modules: ModuleDef[],
  viewer: NavViewer,
  scope: NavScope,
): ModuleDef[] {
  if (scope === "all") return modules;
  if (scope === "agenda") {
    const allowed = new Set(agendaModuleSlugs());
    return modules.filter((m) => allowed.has(m.slug));
  }
  return modules.filter((m) => moduleMatchesViewer(m, viewer));
}

/** Canonical module order for slug lists. */
export function orderModuleSlugs(slugs: string[]): string[] {
  const order = new Map(MODULES.map((m, i) => [m.slug, i]));
  return [...slugs].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}
