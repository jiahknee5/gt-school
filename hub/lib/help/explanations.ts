// Single source of truth for in-app, plain-language EXPLANATIONS — the content behind
// every InfoTip (app/_components/InfoTip.tsx) and the one-line business-objective banner
// (app/_components/PageObjective.tsx). Centralised so an explanation is written ONCE and
// reused everywhere (zero redundancy across pages), and so every metric/column/control
// description stays tied to the module's business objective.
//
// Objective text is sourced from docs/audits/BUSINESS-USECASE-REVIEW.md §2 (the per-module
// business objective + why-it-matters). Element explanations are written here in plain
// language a brand-new user can follow without the PRD.

/** A module/page's headline business objective — the FIRST thing a cold user should read. */
export interface PageObjectiveContent {
  /** WHAT this page is for, in one line (the operator's goal, not a feature list). */
  objective: string;
  /** WHY it matters — the business outcome the objective serves. */
  matters: string;
}

/** A single hover explanation: the human label + a plain-language description. */
export interface Explanation {
  /** The thing being explained (metric / column / control name). */
  label: string;
  /** Plain-language description tied to the business objective. */
  text: string;
}

// ── Per-module business objectives (keyed by module slug + a few sub-surfaces) ──────────
// One entry per page. Read as: "this page exists so a user can <objective>, because <matters>".
export const PAGE_OBJECTIVES: Record<string, PageObjectiveContent> = {
  home: {
    objective: "Open one personal command center that shows this week's marketing health and your next action.",
    matters: "Leadership runs the Monday meeting and every owner starts their day here, so the topline must be legible in seconds.",
  },
  grassroots: {
    objective: "Run the ambassador and referral engine, reconciling community + HubSpot into one trustworthy roster.",
    matters: "Word-of-mouth is the cheapest enrollment channel — influenced enrollments must be measured, not asserted.",
  },
  content: {
    objective: "Manage the editorial pipeline, calendar, and brand voice from brief to published performance.",
    matters: "Content answers family objections at scale; a clear pipeline keeps the team shipping the right pieces.",
  },
  "summer-camp": {
    objective: "Run the summer-camp P&L on reconciled dual sources — capacity, roster, and revenue against target.",
    matters: "Camp is a paid funnel into enrollment; its margin and capacity have to reconcile to one set of numbers.",
  },
  nurture: {
    objective: "Move every family through the lifecycle — segments, sequences, SMS, and the 24-hour follow-up SLA.",
    matters: "Speed-to-lead and disciplined nurture are what convert applicants to deposits; misses must be visible and owned.",
  },
  dashboard: {
    objective: "Read the one shared weekly scorecard the whole team meets on — applicants, deposits, conversion, SLA.",
    matters: "Everyone arguing from the same numbers is the point of the Monday meeting; this board is that single source.",
  },
  "crm-ops": {
    objective: "Own data-infrastructure health: sync parity, attribution integrity, and the data-confidence signal.",
    matters: "Every other module trusts these numbers — when parity drops, the whole Hub flags it from here.",
  },
  events: {
    objective: "Track GT-run field events and propose priority events, with ambassador events shown read-only.",
    matters: "Events are a high-touch top-of-funnel; tracking cost-per-lead keeps field spend accountable.",
  },
  admissions: {
    objective: "Log family objections, bridge them into content briefs, and close the voice-of-customer loop.",
    matters: "The objections families raise are the roadmap for content and messaging that lifts conversion.",
  },
  budget: {
    objective: "Reconcile all marketing spend to the $365K plan by workstream and route over-plan variances to leadership.",
    matters: "No off-book spend and one reconciled total is how marketing keeps the board's trust.",
  },
  decisions: {
    objective: "Run the async governance loop — anyone submits a decision, leadership (only) approves, rejects, or asks for info.",
    matters: "Fast, auditable rulings keep the team unblocked between meetings without losing the paper trail.",
  },
  library: {
    objective: "Find any reusable marketing asset fast with a flat, tag-filterable shelf.",
    matters: "Reusing approved assets keeps the brand consistent and stops the team rebuilding work that exists.",
  },
  analytics: {
    objective: "Read GA4 across both GT sites — top pages, downloads, traffic sources, and conversion paths.",
    matters: "Digital demand is the front of the funnel; knowing what drives sessions tells the team where to invest.",
  },
  submissions: {
    objective: "See the decisions you raised and leadership's ruling on each, in one place.",
    matters: "Submitters need to track their own asks to closure without seeing the full leadership queue.",
  },
  "gt-challenge": {
    objective: "Run the GT Challenge lead magnet end to end — capture, assess, and report cost-per-qualified-lead.",
    matters: "The quiz is a measurable acquisition channel; CPQL lets it be judged beside every other spend.",
  },
};

export type PageObjectiveKey = keyof typeof PAGE_OBJECTIVES;

export function pageObjective(slug: string): PageObjectiveContent | undefined {
  return PAGE_OBJECTIVES[slug];
}

// ── Element-level explanations (keyed "<area>.<element>") ────────────────────────────────
// Keys are namespaced by surface so the same metric name in two modules can carry the
// module-specific meaning, while genuinely shared concepts (data confidence, RBAC) are
// written once under "shared.*" and reused everywhere.
export const EXPLANATIONS = {
  // Shared concepts — written once, reused across every module (no redundancy).
  "shared.data-confidence": {
    label: "Data confidence",
    text: "How well Supabase and HubSpot agree right now. When sync parity drops below threshold this banner appears on every HubSpot-backed module and links to CRM Ops to fix the root cause.",
  },
  "shared.source-of-truth": {
    label: "Source of truth",
    text: "Which system is authoritative for each number, so two screens never disagree. Funnel, income, and grade read app_form; pipeline stages read HubSpot.",
  },
  "shared.your-access": {
    label: "Your access",
    text: "What your signed-in role can read and do on this module. Operators submit asks; leaders rule on them; admins have full read/write.",
  },
  "shared.reporting-week": {
    label: "Reporting week",
    text: "The Monday-anchored week every number on this page is calculated for. Change it to compare this week against last.",
  },

  // Grassroots
  "grassroots.active-ambassadors": {
    label: "Active ambassadors",
    text: "Parents at stage Active or Champion, counted once after the community + HubSpot records are merged — never double-counted across feeds.",
  },
  "grassroots.warm-intros": {
    label: "Warm intros",
    text: "Personal introductions ambassadors made to prospective families, de-duplicated from the activity log so one intro is one count.",
  },
  "grassroots.p2p-calls": {
    label: "P2P calls",
    text: "Parent-to-parent calls logged by ambassadors, de-duplicated from the activity log — a proxy for hands-on referral effort.",
  },
  "grassroots.influenced-enroll": {
    label: "Influenced enrollments",
    text: "Enrollments traced to a referral on app_form attribution — measured from the form, not asserted by a checkbox. Influenced is not the same as incremental (no holdout yet).",
  },
  "grassroots.source-winner": {
    label: "Source winner",
    text: "Which feed (community.gt.school or HubSpot) won this record's fields under survivorship rules when the two disagreed.",
  },
  "grassroots.coverage": {
    label: "Coverage %",
    text: "Contacted divided by total prospects per category. Addresses that could not be geocoded land in an explicit bucket rather than being silently dropped.",
  },

  // Budget
  "budget.plan-total": {
    label: "$365K plan",
    text: "The full marketing budget every workstream reconciles into. The grand total must always equal $365,000 — no off-book spend.",
  },
  "budget.committed": {
    label: "Committed",
    text: "Money contractually promised but not yet paid. Counts against plan immediately so you don't overspend on cash-basis blind spots.",
  },
  "budget.actual": {
    label: "Actual",
    text: "Money actually spent to date. Drives the burn rate and the variance check against the planned amount.",
  },
  "budget.variance": {
    label: "Variance",
    text: "Actual-plus-committed minus planned, as a percentage. Any workstream over plan by more than 10% is routed to the Decision Queue.",
  },
  "budget.burn": {
    label: "Burn",
    text: "Share of the plan already spent or committed. A pacing signal — high burn early in the year is a watch flag.",
  },

  // Dashboard
  "dashboard.applicants": {
    label: "Applicants",
    text: "New applications this week versus last, read from app_form (the authoritative funnel source).",
  },
  "dashboard.deposits": {
    label: "Deposits",
    text: "Families who paid the enrollment deposit this week — the closest leading indicator of revenue.",
  },
  "dashboard.conversion": {
    label: "Conversion",
    text: "Share of applicants that progress to deposit. The headline efficiency metric for the whole funnel.",
  },
  "dashboard.sla": {
    label: "24-hour SLA",
    text: "Percent of new applicants contacted within 24 hours. Speed-to-lead is the single biggest controllable lever on conversion.",
  },

  // CRM Ops
  "crm-ops.parity": {
    label: "Sync parity",
    text: "How closely Supabase and HubSpot match, field by field. Below threshold it trips the data-confidence banner across the Hub.",
  },
  "crm-ops.utm-broken": {
    label: "UTM integrity",
    text: "Share of leads whose campaign attribution survived the form-to-CRM trip. A known-broken area; a missing UTM shows as (not set), never dropped.",
  },
  "crm-ops.reliability": {
    label: "Field reliability",
    text: "Which HubSpot fields are trustworthy. Income, TEFA, and source are known-unreliable by design — app_form is authoritative for those.",
  },

  // Summer camp
  "summer-camp.revenue": {
    label: "Revenue vs target",
    text: "Booked camp revenue against the season target. Camp runs its own P&L and does not roll into the $365K marketing budget.",
  },
  "summer-camp.capacity": {
    label: "Capacity",
    text: "Seats filled versus seats available. Drives both the revenue ceiling and the staffing plan.",
  },
  "summer-camp.roster": {
    label: "Roster (PII-gated)",
    text: "Camper records with personal data. Visible only to roles cleared for PII — others see counts, not names.",
  },

  // Library
  "library.tag-filter": {
    label: "Tag filter",
    text: "Narrow the shelf to assets carrying a tag. Combine with search to find an approved asset in seconds.",
  },

  // Analytics
  "analytics.sessions": {
    label: "Sessions",
    text: "GA4 sessions across both GT sites. The top-of-funnel demand signal before a family ever fills a form.",
  },
  "analytics.conversion-paths": {
    label: "Conversion paths",
    text: "The sequence of sources and pages a converting visitor touched — shows which channels assist, not just which closed.",
  },

  // Decisions
  "decisions.active": {
    label: "Active decisions",
    text: "Open items awaiting a leadership ruling. Leaders approve, reject, or request more info; everyone else only sees their own submissions.",
  },
  "decisions.due": {
    label: "Due date",
    text: "When the submitter needs a ruling by. Drives the priority ordering of the queue.",
  },
} as const satisfies Record<string, Explanation>;

export type ExplanationKey = keyof typeof EXPLANATIONS;

export function explain(key: ExplanationKey): Explanation {
  return EXPLANATIONS[key];
}
