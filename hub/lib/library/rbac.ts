// rbac.ts — the visibility see-gate, enforced at the QUERY layer (invariant #1, Schwartz
// "don't-ship"). A leadership-only resource is never returned to an Operator — not merely
// hidden in the UI. Anyone may upload; owner or Admin may edit/delete.

import type { Role } from "@/lib/phase2";
import type { Resource } from "./types";

export function canSeeLeadership(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader";
}

/** Apply visibility BEFORE search/filter so leadership rows can never leak. */
export function visibleResources(resources: Resource[], role: Role | null | undefined): Resource[] {
  if (canSeeLeadership(role)) return resources;
  return resources.filter((r) => r.visibility === "all");
}

export function canUpload(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader" || role === "operator";
}

export function canEditResource(role: Role | null | undefined, resource: Resource, currentUser: string): boolean {
  return role === "admin" || resource.owner === currentUser;
}
