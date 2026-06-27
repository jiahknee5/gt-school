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
  status: {
    objective: "Read the executive verdict: funnel×spine matrix with one-glance Answer, drill-down, and cross-cutting rail.",
    matters: "Leadership needs a binding narrative before the Monday standup — where we stand, what's driving it, and what to decide.",
  },
  grassroots: {
    objective: "Run the ambassador and referral engine, reconciling community + HubSpot into one trustworthy roster.",
    matters: "Word-of-mouth is the cheapest enrollment channel, so influenced enrollments must be measured, not asserted.",
  },
  content: {
    objective: "Manage the editorial pipeline, calendar, and brand voice from brief to published performance.",
    matters: "Content answers family objections at scale; a clear pipeline keeps the team shipping the right pieces.",
  },
  "summer-camp": {
    objective: "Run the summer-camp P&L on reconciled dual sources: capacity, roster, and revenue against target.",
    matters: "Camp is a paid funnel into enrollment; its margin and capacity have to reconcile to one set of numbers.",
  },
  nurture: {
    objective: "Move every family through the lifecycle: segments, sequences, SMS, and the 24-hour follow-up SLA.",
    matters: "Speed-to-lead and disciplined nurture are what convert applicants to deposits; misses must be visible and owned.",
  },
  dashboard: {
    objective: "Read the one shared weekly scorecard the whole team meets on: applicants, deposits, conversion, SLA.",
    matters: "Everyone arguing from the same numbers is the point of the Monday meeting; this board is that single source.",
  },
  "crm-ops": {
    objective: "Own data-infrastructure health: sync parity, attribution integrity, and the data-confidence signal.",
    matters: "Every other module trusts these numbers. When parity drops, the whole Hub flags it from here.",
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
    objective: "Run the async governance loop: anyone submits a decision; leadership approves, rejects, or asks for info.",
    matters: "Fast, auditable rulings keep the team unblocked between meetings without losing the paper trail.",
  },
  library: {
    objective: "Find any reusable marketing asset fast with a flat, tag-filterable shelf.",
    matters: "Reusing approved assets keeps the brand consistent and stops the team rebuilding work that exists.",
  },
  analytics: {
    objective: "Read GA4 across both GT sites: top pages, downloads, traffic sources, and conversion paths.",
    matters: "Digital demand is the front of the funnel; knowing what drives sessions tells the team where to invest.",
  },
  submissions: {
    objective: "See the decisions you raised and leadership's ruling on each, in one place.",
    matters: "Submitters need to track their own asks to closure without seeing the full leadership queue.",
  },
  "gt-challenge": {
    objective: "Run the GT Challenge lead magnet end to end: capture, assess, and report cost-per-qualified-lead.",
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
    text: "Sets the week used for Dashboard reporting snapshots and Home widgets opened with a week link. Operational modules keep their own source dates and are not changed by this selector.",
  },

  // Grassroots
  "grassroots.active-ambassadors": {
    label: "Active ambassadors",
    text: "Parents at stage Active or Champion, counted once after the community + HubSpot records are merged. Never double-counted across feeds.",
  },
  "grassroots.warm-intros": {
    label: "Warm intros",
    text: "Personal introductions ambassadors made to prospective families, de-duplicated from the activity log so one intro is one count.",
  },
  "grassroots.p2p-calls": {
    label: "P2P calls",
    text: "Parent-to-parent calls logged by ambassadors and de-duplicated from the activity log. A proxy for hands-on referral effort.",
  },
  "grassroots.influenced-enroll": {
    label: "Influenced enrollments",
    text: "Enrollments traced to a referral on app_form attribution. Measured from the form, not asserted by a checkbox. Influenced is not the same as incremental (no holdout yet).",
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
    text: "The full marketing budget every workstream reconciles into. The grand total must always equal $365,000. No off-book spend.",
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
    text: "Share of the plan already spent or committed. High burn early in the year is a watch flag.",
  },

  // Dashboard — the four headline meta-KPIs on the scorecard surface
  "dashboard.measured": {
    label: "Measured KPIs",
    text: "How many scorecard rows are backed by a live instrumented source versus shown low-confidence. The honesty gauge for the whole board.",
  },
  "dashboard.biggest-mover": {
    label: "Biggest mover",
    text: "The KPI that changed most versus last week. The meeting conversation should start here.",
  },
  "dashboard.at-risk": {
    label: "At risk",
    text: "KPIs tracking below 90% of the run-rate needed to hit goal. These are the red flags to act on this week.",
  },
  "dashboard.stale": {
    label: "Stale connectors",
    text: "Sources whose last sync exceeded its freshness SLA, so their numbers may be out of date until the connector catches up.",
  },
  "dashboard.applicants": {
    label: "Applicants",
    text: "New applications this week versus last, read from app_form (the authoritative funnel source).",
  },
  "dashboard.deposits": {
    label: "Deposits",
    text: "Families who paid the enrollment deposit this week. The closest leading indicator of revenue.",
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
    text: "Which HubSpot fields are trustworthy. Income, TEFA, and source are known-unreliable by design; app_form is authoritative for those.",
  },
  "crm-ops.open-issues": {
    label: "Open issues",
    text: "Data-quality issues currently open, auto-detected plus manual. The auto-detector is idempotent, so re-running never double-files the same issue.",
  },
  "crm-ops.lead-scoring": {
    label: "Lead scoring",
    text: "Share of families that carry a HubSpot lead score. Read-only here; the Hub never writes scores back to HubSpot.",
  },

  // Summer camp
  "summer-camp.capacity-sold": {
    label: "Capacity sold",
    text: "Paid seats divided by total seats across all four campuses. The revenue ceiling and the staffing signal in one number.",
  },
  "summer-camp.cash-revenue": {
    label: "Cash revenue",
    text: "Money actually collected via Stripe for camp, against the season target. Cash truth; booked/expected is shown separately.",
  },
  "summer-camp.reconciled-dupes": {
    label: "Reconciled dupes",
    text: "Families that appeared in both summer.gt.school and the registration form and were merged into one golden record, so nobody is counted twice.",
  },
  "summer-camp.waitlist": {
    label: "Waitlist",
    text: "Families at status waitlisted. Demand beyond current capacity can justify adding a session.",
  },
  "summer-camp.roster": {
    label: "Roster (PII-gated)",
    text: "Camper records with personal data. Visible only to roles cleared for minors' PII; others see counts, not names.",
  },

  // Content
  "content.in-flight": {
    label: "In flight",
    text: "Pieces not yet published. Everything still moving through concept, production, review, or scheduled.",
  },
  "content.published": {
    label: "Published",
    text: "Pieces shipped this sprint. The output signal for the editorial engine.",
  },
  "content.x-conversion": {
    label: "X conversion share",
    text: "Share of attributed conversions credited to X (Twitter), measured from a real app_form x UTM join. It is not a fixed assumption, so it moves with the data.",
  },
  "content.sync-conflicts": {
    label: "Sync conflicts",
    text: "Pieces edited on both the Hub and the Google Sheet at once. Both values are retained for review and never silently clobbered.",
  },

  // Library
  "library.resources": {
    label: "Resources",
    text: "How many assets your role is allowed to see. Visibility is enforced at the query layer, so leadership-only items never reach an Operator.",
  },
  "library.showing": {
    label: "Showing",
    text: "How many assets match your current search and tag filter out of the total you can see.",
  },
  "library.dead-links": {
    label: "Dead links",
    text: "Assets whose link could not be reached, flagged so the shelf stays trustworthy instead of pointing at broken files.",
  },
  "library.tag-filter": {
    label: "Tag filter",
    text: "Narrow the shelf to assets carrying a tag. Combine with search to find an approved asset in seconds.",
  },

  // Analytics
  "analytics.sessions": {
    label: "Total sessions",
    text: "GA4 sessions across both GT sites, where aggregate equals the sum of the two properties. No cross-property double-count. The top-of-funnel demand signal.",
  },
  "analytics.bounce": {
    label: "Bounce",
    text: "Share of sessions that did not engage, using one shared definition (1 minus engaged-sessions over sessions) everywhere so the number never disagrees between views.",
  },
  "analytics.avg-duration": {
    label: "Avg duration",
    text: "Average session length, modeled from GA4 engagement signals. A depth-of-interest proxy alongside raw session counts.",
  },
  "analytics.pdf-downloads": {
    label: "PDF downloads",
    text: "Resource downloads this window. A mid-funnel intent signal because a family pulling a curriculum PDF is leaning in.",
  },
  "analytics.conversion-paths": {
    label: "Conversion paths",
    text: "The sequence of sources and pages a converting visitor touched. Shows which channels assist, not just which closed.",
  },

  // Field Marketing & Events
  "events.upcoming": {
    label: "Upcoming (30d)",
    text: "GT-organized events scheduled in the next 30 days. The near-term field workload to staff and promote.",
  },
  "events.completed": {
    label: "Completed this month",
    text: "GT-organized events finished this month. The basis for attendance and consult follow-through.",
  },
  "events.attendance": {
    label: "Attendance rate",
    text: "Total attended divided by total RSVPs across events. Shows how well interest converts to show-ups.",
  },
  "events.consult": {
    label: "Event to consult",
    text: "Estimated share of attendees who booked a consult. Uninstrumented in v1 and always badged manual; never presented as tracked.",
  },

  // Decisions
  "decisions.active": {
    label: "Open",
    text: "Items awaiting a leadership ruling. Leaders approve, reject, or request more info; everyone else only sees their own submissions.",
  },
  "decisions.urgent-open": {
    label: "Urgent open",
    text: "Open decisions marked urgent. These are due first and should lead the meeting's governance segment.",
  },
  "decisions.awaiting-info": {
    label: "Awaiting info",
    text: "Decisions a leader sent back for more information. They sit in a need-more-info loop until the submitter responds.",
  },
  "decisions.budget-at-stake": {
    label: "Budget at stake",
    text: "Total dollars requested across all active asks. The financial exposure currently waiting on a ruling.",
  },
} as const satisfies Record<string, Explanation>;

export type ExplanationKey = keyof typeof EXPLANATIONS;

export function explain(key: ExplanationKey): Explanation {
  return EXPLANATIONS[key];
}
