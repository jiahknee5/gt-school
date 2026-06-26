// search.ts — small-n recall over title + description + tags + owner, case/diacritic-folded
// (invariant #4). Facet filters by tag/owner. Visibility is applied SEPARATELY (rbac.ts)
// before search so a query can never leak a leadership-only row.

import type { Resource, Tag } from "./types";

export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const SYNONYMS: Record<string, string[]> = {
  results: ["outcomes", "tracker"],
  plan: ["playbook", "strategy"],
  deck: ["slides", "presentation"],
};

function haystack(r: Resource): string {
  return fold([r.title, r.description, r.tags.join(" "), r.owner].join(" "));
}

export function searchResources(resources: Resource[], query: string): Resource[] {
  const q = fold(query);
  if (!q) return resources;
  const expanded = [q, ...(SYNONYMS[q] ?? []).map(fold)];
  return resources.filter((r) => {
    const hay = haystack(r);
    return expanded.some((term) => hay.includes(term));
  });
}

export interface Facets {
  tag?: Tag;
  owner?: string;
}

export function filterResources(resources: Resource[], facets: Facets): Resource[] {
  return resources.filter((r) => {
    if (facets.tag && !r.tags.includes(facets.tag)) return false;
    if (facets.owner && r.owner !== facets.owner) return false;
    return true;
  });
}
