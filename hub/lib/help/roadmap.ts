/**
 * Build-order roadmap for the 13 GT Marketing Hub modules. Rendered in the Help
 * section (/help/roadmap). The order is dependency- and value-driven: foundation
 * first (auth/RBAC + shell), then the modules that PROVE the whole system (the four
 * "show us it works" signals + SSOT + reconciliation + RBAC), then depth, then the
 * funnel/loop modules, then the light manual-entry surfaces.
 *
 * Source of truth for the modules themselves: lib/modules.ts. Per-module specs:
 * docs/modules/<NN>-<slug>/PLAN.md. Requirements: docs/01-intake/REQUIREMENTS.md.
 */

export type BuildStatus = "foundation" | "build-deep" | "build" | "stub";

export interface RoadmapItem {
  order: number;
  /** Module number from lib/modules.ts, or null for the foundation. */
  n: number | null;
  slug: string | null;
  module: string;
  why: string;
  /** "show us it works" demo signals this lights up (if any). */
  signals: string[];
  depends: string;
  status: BuildStatus;
}

export interface RoadmapTier {
  tier: number;
  label: string;
  rationale: string;
  items: RoadmapItem[];
}

export const ROADMAP: RoadmapTier[] = [
  {
    tier: 0,
    label: "Foundation — unblocks everything",
    rationale:
      "Nothing else can satisfy its RBAC requirement without this. Auth + three roles is the #1 P0 gap; the composable Home needs per-user identity; the Decision Queue gate and the data-confidence banner slot are app-wide.",
    items: [
      {
        order: 0,
        n: null,
        slug: null,
        module: "Auth + RBAC + app shell",
        why: "App-level session + Admin/Leader/Operator roles, the module shell/nav, and the global data-confidence banner slot. Every module's role gating and Home personalization depend on it.",
        signals: ["role denied the Decision Queue"],
        depends: "—",
        status: "foundation",
      },
    ],
  },
  {
    tier: 1,
    label: "Prove the system end-to-end",
    rationale:
      "These three light up three of the four demo signals and exercise the scored themes — single source of truth, dual-source reconciliation, idempotency, and RBAC — with data the backbone + seed already model. Build these deep.",
    items: [
      {
        order: 1,
        n: 7,
        slug: "crm-ops",
        module: "CRM / Marketing Operations",
        why: "Owns sync parity, the data-confidence banner all modules consume, UTM health, and the auto-detecting data-quality queue — the trust spine. Backbone + seed already model parity/DQ.",
        signals: ["data-confidence banner appears", "open data query changes a decision"],
        depends: "Foundation",
        status: "build-deep",
      },
      {
        order: 2,
        n: 10,
        slug: "budget",
        module: "Budget Tracker",
        why: "Hub is system-of-record (no external dependency); seed reconciles exactly to $365K and pushes one workstream >10% over plan. Fast to build, high demo signal.",
        signals: ["a budget reconcile to the total"],
        depends: "Foundation",
        status: "build-deep",
      },
      {
        order: 3,
        n: 11,
        slug: "decisions",
        module: "Decision Queue",
        why: "The RBAC showcase (Leader-only view/act, Operator submit-not-view) and the sink for budget variance auto-flags + hot-family escalations.",
        signals: ["role denied the Decision Queue", "watch a payment propagate"],
        depends: "Foundation, Budget (variance feeds it)",
        status: "build-deep",
      },
    ],
  },
  {
    tier: 2,
    label: "Depth + the shared scorecard",
    rationale:
      "The leadership surfaces and the most data-rich module. Dashboard reads the modules already built; Nurture is the deepest single module; Home composes widgets the earlier tiers expose.",
    items: [
      {
        order: 4,
        n: 6,
        slug: "dashboard",
        module: "Dashboard / KPI Tracking",
        why: "The canonical shared scorecard everyone references in the Monday meeting; reads each module's primary metric. Needs Tier-1 modules to aggregate.",
        signals: [],
        depends: "Tier 1 modules (reads their metrics)",
        status: "build-deep",
      },
      {
        order: 5,
        n: 5,
        slug: "nurture",
        module: "Nurture & Lifecycle",
        why: "Most data-rich module; engagement tier is the top conversion predictor; segments, 24-hr SLA, SMS inbox. Seed models the conversion drivers.",
        signals: [],
        depends: "Foundation, CRM Ops (data confidence)",
        status: "build-deep",
      },
      {
        order: 6,
        n: 1,
        slug: "home",
        module: "Home / Command Center",
        why: "Composable per-user dashboard — the widget library aggregates from the modules already built. Frame ships in Foundation; widgets fill in as modules land.",
        signals: [],
        depends: "Foundation + the modules whose widgets it shows",
        status: "build",
      },
    ],
  },
  {
    tier: 3,
    label: "Grow the funnel + close the loop",
    rationale:
      "The growth and feedback modules and the second reconciliation showcase (ambassadors). They feed the cross-module auto-links (testimonial→content, objection→brief, hot-family→Decision Queue).",
    items: [
      {
        order: 7,
        n: 2,
        slug: "grassroots",
        module: "Grassroots Engine",
        why: "Ambassador program with the HubSpot + community.gt.school dual-source reconcile (showcase #2); referral sprints; parent events that cross-link to Field Marketing.",
        signals: [],
        depends: "Foundation, CRM Ops",
        status: "build",
      },
      {
        order: 8,
        n: 9,
        slug: "admissions",
        module: "Admissions & Voice of Customer",
        why: "Objection log → auto content-brief cross-link; hot-family escalation → Decision Queue; the feedback-to-marketing loop.",
        signals: [],
        depends: "Decision Queue, Content",
        status: "build",
      },
      {
        order: 9,
        n: 3,
        slug: "content",
        module: "Content & Thought Leadership",
        why: "Production pipeline (Google Sheet synced), per-piece performance via UTM; receives testimonial + objection stubs from Grassroots/Admissions.",
        signals: [],
        depends: "Grassroots, Admissions (stub producers)",
        status: "build",
      },
      {
        order: 10,
        n: 13,
        slug: "analytics",
        module: "Website & Digital Analytics",
        why: "GA4 across gt.school + anywhere.gt.school; feeds CRM Ops UTM attribution and Content's top-pages context.",
        signals: [],
        depends: "CRM Ops (attribution chain)",
        status: "build",
      },
    ],
  },
  {
    tier: 4,
    label: "Lighter / manual-entry surfaces",
    rationale:
      "Smaller scope or manual-entry-only. Build last; honest stubs are acceptable for the competition once the high-signal modules are deep.",
    items: [
      {
        order: 11,
        n: 4,
        slug: "summer-camp",
        module: "Summer Camp",
        why: "Separate P&L (not in the $365K budget); the summer.gt.school + registration-form dual-source reconcile. Lighter than the Tier-1 modules.",
        signals: [],
        depends: "CRM Ops (reconcile patterns)",
        status: "build",
      },
      {
        order: 12,
        n: 8,
        slug: "events",
        module: "Field Marketing & Events",
        why: "Manual entry; event tracker + priority-event recommendations to the Decision Queue; read-only overlay of ambassador events from Grassroots.",
        signals: [],
        depends: "Decision Queue, Grassroots",
        status: "stub",
      },
      {
        order: 13,
        n: 12,
        slug: "library",
        module: "Resource Library",
        why: "Flat, searchable shelf — no automation, no versioning. Smallest module; build last.",
        signals: [],
        depends: "Foundation",
        status: "stub",
      },
    ],
  },
];

export function roadmapCounts() {
  const items = ROADMAP.flatMap((t) => t.items);
  return {
    tiers: ROADMAP.length,
    modules: items.filter((i) => i.n !== null).length,
    deep: items.filter((i) => i.status === "build-deep").length,
    signals: new Set(items.flatMap((i) => i.signals)).size,
  };
}
