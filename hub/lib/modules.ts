// Single source of truth for the 13 GT Marketing Hub modules (PRD §2 module list).
// Consumed by the sidebar nav (hub/app/_components/Sidebar.tsx), the Home overview
// grid (hub/app/page.tsx), and module routing (hub/app/m/[slug]/page.tsx).

export type Tint = "violet" | "amber" | "green" | "blue";

export type ModuleDef = {
  n: number;
  slug: string;
  name: string; // full name — page titles + Home grid
  short: string; // sidebar label
  owner: string;
  tint: Tint;
  leaderOnly?: boolean; // Decision Queue is Leadership-only (PRD §2 roles)
};

export const MODULES: ModuleDef[] = [
  { n: 1, slug: "home", name: "Home / Command Center", short: "Home", owner: "All (personal)", tint: "blue" },
  { n: 2, slug: "grassroots", name: "Grassroots Engine", short: "Grassroots", owner: "Grassroots Owner", tint: "green" },
  { n: 3, slug: "content", name: "Content & Thought Leadership", short: "Content", owner: "Content Owner", tint: "violet" },
  { n: 4, slug: "summer-camp", name: "Summer Camp", short: "Summer Camp", owner: "Content Owner", tint: "amber" },
  { n: 5, slug: "nurture", name: "Nurture & Lifecycle", short: "Nurture", owner: "Marketing Lead", tint: "blue" },
  { n: 6, slug: "dashboard", name: "Dashboard / KPI Tracking", short: "Dashboard", owner: "Marketing Lead", tint: "green" },
  { n: 7, slug: "crm-ops", name: "CRM / Marketing Operations", short: "CRM Ops", owner: "Marketing Lead", tint: "violet" },
  { n: 8, slug: "events", name: "Field Marketing & Events", short: "Field & Events", owner: "Field & Events Owner", tint: "amber" },
  { n: 9, slug: "admissions", name: "Admissions & Voice of Customer", short: "Admissions", owner: "Admissions Owner", tint: "blue" },
  { n: 10, slug: "budget", name: "Budget Tracker", short: "Budget", owner: "Budget Owner", tint: "green" },
  { n: 11, slug: "decisions", name: "Decision Queue", short: "Decision Queue", owner: "Leadership only", tint: "violet", leaderOnly: true },
  { n: 12, slug: "library", name: "Resource Library", short: "Library", owner: "All", tint: "amber" },
  { n: 13, slug: "analytics", name: "Website & Digital Analytics", short: "Analytics", owner: "Marketing Lead", tint: "blue" },
];

// Categorical tint → soft-bg + fg utility pair (tokens defined in globals.css).
export const TINT_CLASS: Record<Tint, string> = {
  violet: "bg-violet-soft text-violet",
  amber: "bg-amber-soft text-amber",
  green: "bg-green-soft text-green",
  blue: "bg-blue-soft text-blue",
};

// Home is the "/" route; the other 12 modules live under /m/<slug>.
export function moduleHref(slug: string): string {
  return slug === "home" ? "/" : `/m/${slug}`;
}

export function moduleBySlug(slug: string): ModuleDef | undefined {
  return MODULES.find((m) => m.slug === slug);
}
