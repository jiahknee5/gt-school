// Single source of truth for the 13 GT Marketing Hub modules (PRD §2 module list).
// Consumed by the sidebar nav (hub/app/_components/Sidebar.tsx), the Home overview
// grid (hub/app/page.tsx), and module routing (hub/app/m/[slug]/page.tsx).

export type Tint = "violet" | "amber" | "green" | "blue";
export type ModuleGroup = "command" | "channels" | "pipeline" | "operations";

export type ModuleDef = {
  n: number;
  slug: string;
  name: string; // full name — page titles + Home grid
  short: string; // sidebar label
  group: ModuleGroup; // top-level IA neighborhood; no route/permission meaning
  owner: string; // free-text owner label (Home grid / page chrome display)
  /**
   * Canonical functional-role owner(s) for this module (PRD §2 module list). The
   * FIRST entry is the primary presenter/owner; additional entries are co-owners
   * (e.g. Admissions is co-owned by the Field & Events Owner + Admissions Owner).
   * These align 1:1 with DemoUser.functionalRoles + ownsModules in lib/phase2.ts.
   */
  owners: string[];
  tint: Tint;
  leaderOnly?: boolean; // Decision Queue is Leadership-only (PRD §2 roles)
  /**
   * The §5 weekly-meeting agenda item this module anchors (1–8). Undefined for
   * off-agenda modules (Summer Camp, Field & Events, Budget, Library) that still
   * need a home + owner but are not walked in the Monday meeting. Two modules can
   * share a slot (Nurture + CRM Ops both anchor agenda item 5).
   */
  agendaSlot?: number;
};

export type ModuleNavGroup = {
  key: ModuleGroup;
  label: string;
  description: string;
  slugs: string[];
};

export const MODULES: ModuleDef[] = [
  { n: 1, slug: "home", name: "Home / Command Center", short: "Home", group: "command", owner: "All (personal)", owners: ["All"], tint: "blue", agendaSlot: 1 },
  { n: 14, slug: "status", name: "Status / Exec Verdict Board", short: "Status", group: "command", owner: "Leadership", owners: ["Leadership"], tint: "blue" },
  { n: 2, slug: "grassroots", name: "Grassroots Engine", short: "Grassroots", group: "channels", owner: "Grassroots Owner", owners: ["Grassroots Owner"], tint: "green", agendaSlot: 3 },
  { n: 3, slug: "content", name: "Content & Thought Leadership", short: "Content", group: "channels", owner: "Content Owner", owners: ["Content Owner"], tint: "violet", agendaSlot: 4 },
  { n: 4, slug: "summer-camp", name: "Summer Camp", short: "Summer Camp", group: "channels", owner: "Content Owner", owners: ["Content Owner"], tint: "amber" },
  { n: 5, slug: "nurture", name: "Nurture & Lifecycle", short: "Nurture", group: "pipeline", owner: "Marketing Lead", owners: ["Marketing Lead"], tint: "blue", agendaSlot: 5 },
  { n: 6, slug: "dashboard", name: "Dashboard / KPI Tracking", short: "Dashboard", group: "command", owner: "Marketing Lead", owners: ["Marketing Lead"], tint: "green", agendaSlot: 2 },
  { n: 7, slug: "crm-ops", name: "CRM / Marketing Operations", short: "CRM Ops", group: "pipeline", owner: "Marketing Lead", owners: ["Marketing Lead"], tint: "violet", agendaSlot: 5 },
  { n: 8, slug: "events", name: "Field Marketing & Events", short: "Field & Events", group: "channels", owner: "Field & Events Owner", owners: ["Field & Events Owner"], tint: "amber" },
  { n: 9, slug: "admissions", name: "Admissions & Voice of Customer", short: "Admissions", group: "pipeline", owner: "Field & Events / Admissions Owner", owners: ["Field & Events Owner", "Admissions Owner"], tint: "blue", agendaSlot: 6 },
  { n: 10, slug: "budget", name: "Budget Tracker", short: "Budget", group: "operations", owner: "Budget Owner", owners: ["Budget Owner"], tint: "green" },
  { n: 11, slug: "decisions", name: "Decision Queue", short: "Decision Queue", group: "command", owner: "Leadership only", owners: ["Leadership"], tint: "violet", leaderOnly: true, agendaSlot: 8 },
  { n: 12, slug: "library", name: "Resource Library", short: "Library", group: "operations", owner: "All", owners: ["All"], tint: "amber" },
  { n: 13, slug: "analytics", name: "Website & Digital Analytics", short: "Analytics", group: "operations", owner: "Marketing Lead", owners: ["Marketing Lead"], tint: "blue", agendaSlot: 7 },
];

// Sidebar IA follows the repo IA audit: Command (see/decide), Channels (reach
// families), Pipeline (move families forward), Operations (money/analytics/assets).
export const MODULE_NAV_GROUPS: ModuleNavGroup[] = [
  {
    key: "command",
    label: "Command",
    description: "Overview, scorecard, and leadership calls.",
    slugs: ["home", "status", "dashboard", "decisions"],
  },
  {
    key: "channels",
    label: "Channels",
    description: "Acquisition engines that reach families.",
    slugs: ["grassroots", "content", "summer-camp", "events"],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    description: "Follow-up, data quality, and admissions feedback.",
    slugs: ["nurture", "crm-ops", "admissions"],
  },
  {
    key: "operations",
    label: "Operations",
    description: "Budget, web analytics, and shared assets.",
    slugs: ["budget", "analytics", "library"],
  },
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

export function modulesByNavGroup(
  modules: ModuleDef[],
): { group: ModuleNavGroup; modules: ModuleDef[] }[] {
  const visible = new Set(modules.map((m) => m.slug));
  return MODULE_NAV_GROUPS.map((group) => ({
    group,
    modules: group.slugs
      .filter((slug) => visible.has(slug))
      .map((slug) => moduleBySlug(slug))
      .filter((m): m is ModuleDef => Boolean(m)),
  }));
}

/**
 * Modules that anchor a §5 weekly-meeting agenda item, in agenda order. Powers any
 * "Run the Monday Meeting" view and the Help documentation. Ties (Nurture + CRM Ops
 * both at slot 5) fall back to module number so the lower-numbered module leads.
 */
export function modulesInAgendaOrder(): ModuleDef[] {
  return MODULES.filter((m) => m.agendaSlot != null).sort(
    (a, b) => (a.agendaSlot! - b.agendaSlot!) || (a.n - b.n),
  );
}

/** Off-agenda modules that still need a home + owner (Summer Camp, Field & Events, Budget, Library). */
export function offAgendaModules(): ModuleDef[] {
  return MODULES.filter((m) => m.agendaSlot == null);
}
