// Single source of truth for the in-app Help section (app/help). Each guide is a
// COMMON CROSS-MODULE OBJECTIVE written as a user guide: what you're trying to do,
// who does it, the modules it spans, and the ordered steps (what you click, where,
// what happens). Curated by the gt-hub-cohesion-panel skill. Two are provided by
// the PRD: the GT Challenge worked example and the §5 weekly-meeting agenda.

export type GuideCategory =
  | "Run the cadence"
  | "Grow the funnel"
  | "Close the loop"
  | "Govern & trust"
  | "Personalize";

export interface GuideStep {
  /** The action the user takes. */
  do: string;
  /** Where in the Hub it happens (module · sub-view). */
  where: string;
  /** What the system does in response (the payoff / state change). */
  result: string;
}

export interface Guide {
  slug: string;
  title: string;
  category: GuideCategory;
  /** One-line outcome. */
  objective: string;
  /** Roles who perform / consume this journey. */
  who: string[];
  /** Modules the journey spans (display names). */
  modules: string[];
  /** When the journey starts. */
  trigger: string;
  steps: GuideStep[];
  /** What "done well" looks like — the acceptance bar. */
  success: string[];
  /** Pitfalls, data-confidence, and honesty notes. */
  watchFor: string[];
  /** Related guide slugs. */
  related: string[];
  /** Set when the journey is described in the PRD. */
  fromSpec?: string;
}

export const GUIDES: Guide[] = [
  // ─────────────────────────────── Run the cadence ───────────────────────────────
  {
    slug: "weekly-meeting",
    title: "Run the Monday marketing meeting from the Hub",
    category: "Run the cadence",
    objective:
      "Drive the entire weekly marketing meeting off the Hub — recap, scorecard, each workstream, and decisions — without anyone opening a spreadsheet.",
    who: ["Leadership", "Marketing Lead", "Workstream owners"],
    modules: [
      "Home",
      "Dashboard / KPI",
      "Grassroots",
      "Content",
      "Nurture",
      "CRM Ops",
      "Admissions",
      "Analytics",
      "Decision Queue",
    ],
    trigger: "Start of the weekly marketing meeting (per the spec's 8-item agenda).",
    steps: [
      { do: "Set the week-of selector and read the Executive Narrative (topline / working / stuck / decisions).", where: "Home · top bar + Executive narrative widget", result: "Everyone is anchored on the same week and the 5-minute exec recap." },
      { do: "Scan the canonical scorecard — applicants, deposits, conversion, SLA, handoffs — this week vs last with status chips.", where: "Dashboard / KPI · Scorecard", result: "Shared numbers; biggest movers and red flags are obvious." },
      { do: "Walk each workstream's Overview in turn (Grassroots → Content → Nurture/CRM Ops → Admissions → Analytics).", where: "Each module · Overview", result: "Each owner reports from their live dashboard; goal pacing is visible." },
      { do: "Close on open decisions — approve / reject / need-info each card.", where: "Decision Queue · Active decisions", result: "Decisions are recorded with a ruling + comment; submitters get notified." },
    ],
    success: [
      "Every agenda item maps to a Hub screen — no external docs.",
      "The scorecard everyone sees is identical (it is the shared, versioned board).",
      "Every decision raised during the week is resolved or explicitly deferred.",
    ],
    watchFor: [
      "If a data-confidence banner is showing, call it out — some HubSpot numbers may be mid-drift (see CRM Ops).",
      "Home is personal; the Scorecard is shared. Use the Scorecard for the meeting so everyone reads the same thing.",
    ],
    related: ["compose-home", "raise-a-decision", "data-confidence"],
    fromSpec: "PRD §5 Meeting integration — the agenda maps item-by-item to modules.",
  },
  {
    slug: "compose-home",
    title: "Compose your personal Home dashboard",
    category: "Personalize",
    objective: "Build a Home view that shows exactly the widgets your role cares about — and act on it.",
    who: ["Every role (Leader, Admin, Operator)"],
    modules: ["Home", "(all modules as widget sources)"],
    trigger: "First login, or whenever your focus changes.",
    steps: [
      { do: "Start from the role-aware widget pack and use the source tags to pick the modules you need to inspect.", where: "Home · widgets", result: "The starter layout is private to the signed-in user." },
      { do: "Save layout changes through the Home layout API when add/remove/reorder controls are wired.", where: "Home · layout persistence", result: "The ordered widget list is stored per user." },
      { do: "(Leaders) Rule on decisions in the Decision Queue module.", where: "Decision Queue · Active decisions", result: "Actions are recorded with a leadership note." },
    ],
    success: [
      "The default starter pack loads for new users; client-side customization can persist through the layout API.",
      "Saved layouts survive reloads once a Home client writes the ordered widget list.",
    ],
    watchFor: ["Your Home is yours — it is not the shared scorecard. For shared numbers use Dashboard / KPI."],
    related: ["weekly-meeting", "raise-a-decision"],
  },

  // ─────────────────────────────── Grow the funnel ───────────────────────────────
  {
    slug: "gt-challenge",
    title: "Launch & run the GT Challenge lead magnet",
    category: "Grow the funnel",
    objective:
      "Stand up the GT Challenge as a campaign, capture quiz submissions as leads, auto-assess them, and report cost-per-qualified-lead beside other channels — the whole capture→assess→reconcile→report loop.",
    who: ["Marketing Lead", "Program/assessment", "Leadership"],
    modules: ["Budget", "CRM Ops", "Nurture", "Admissions", "Dashboard / KPI"],
    trigger: "GT decides to publish a gifted-style quiz on social as a lead magnet.",
    steps: [
      { do: "Create the Challenge as a campaign with spend that rolls into a budget workstream.", where: "Budget · Budget table (grassroots workstream)", result: "Spend reconciles into the $365K plan under the same rules as every line." },
      { do: "Publish the public quiz; a parent submits with consent and UTM captured.", where: "Public surface · /gifted-quiz", result: "A submission is stored, deduped, and becomes a lead in the CRM with its UTM intact." },
      { do: "Let the program auto-score each submission and bucket the child.", where: "Assessment (AI grader)", result: "Each submission is scored once (no double-count); qualified fits route into the admissions funnel." },
      { do: "Read the Challenge KPI row — spend, submissions, qualified, cost-per-qualified-lead — next to other channels.", where: "Dashboard / KPI + Home widget", result: "CPQL is a measured number, optionally enriched with Open Data." },
    ],
    success: [
      "A submission propagates capture → lead → assessment → KPI in one motion.",
      "Resubmitting the same answers does not create a second lead.",
      "Challenge spend is inside a workstream and the budget still totals $365K.",
    ],
    watchFor: [
      "A child takes the quiz — parent consent is required before anything persists.",
      "It is a fit screen, not a gifted verdict; there is no 'not gifted' bucket.",
      "CPQL must be computed (spend ÷ qualified), never a placeholder figure.",
    ],
    related: ["new-applicant", "budget-variance", "raise-a-decision"],
    fromSpec: "PRD worked example — see also docs/06-gt-challenge/WORKFLOW.md.",
  },
  {
    slug: "new-applicant",
    title: "Track a new applicant from click to deposit",
    category: "Grow the funnel",
    objective: "Follow one family end-to-end — from the ad/UTM click through nurture and admissions to a deposit — with the numbers reconciling.",
    who: ["Marketing Lead", "Nurture", "Admissions"],
    modules: ["Analytics", "CRM Ops", "Nurture", "Admissions", "Dashboard / KPI"],
    trigger: "A visitor lands on a GT site from a campaign and submits the application form.",
    steps: [
      { do: "Confirm the landing + source for the session and that the UTM resolved.", where: "Analytics · Traffic sources / Conversion paths", result: "The visit is attributed to a campaign; UTM origin is captured." },
      { do: "Verify the lead's attribution chain (form → Supabase → HubSpot) is intact.", where: "CRM Ops · Source tracking", result: "The lead carries a valid, single source of truth (app_form for funnel/income/grade)." },
      { do: "Place the contact in a segment and confirm the 24-hr follow-up SLA is met.", where: "Nurture · Segments + SLA tracker", result: "The right sequence + owner engage; the contact moves through the pipeline." },
      { do: "Watch the contact progress to applicant → shadow → deposit and hand off to onboarding.", where: "Admissions + Nurture · Pipeline stages", result: "The deposit and handoff increment the scorecard." },
    ],
    success: [
      "Every number on the journey reads its authoritative source (funnel/income from app_form, pipeline from HubSpot).",
      "The deposit appears in the Dashboard scorecard with channel attribution.",
    ],
    watchFor: ["UTM attribution is a known broken area until CRM Ops fixes it — a missing UTM shows as (not set), not dropped."],
    related: ["follow-up-sla", "gt-challenge", "data-confidence"],
  },
  {
    slug: "follow-up-sla",
    title: "Hit the 24-hour follow-up SLA",
    category: "Grow the funnel",
    objective: "Make sure every new applicant is contacted within 24 hours, and that misses are visible and owned.",
    who: ["Marketing Lead", "Workstream owners"],
    modules: ["Nurture", "Dashboard / KPI"],
    trigger: "New applicants enter the funnel today.",
    steps: [
      { do: "Open the SLA tracker and read today's entrants and the % contacted within the window.", where: "Nurture · SLA tracker", result: "Live SLA compliance with a red late-list." },
      { do: "Work the late-list; each row shows the owner who is behind.", where: "Nurture · SLA tracker (late-list)", result: "Owner-attributable follow-up; contacts get cleared." },
      { do: "Confirm the 30-day SLA trend on the shared board.", where: "Dashboard / KPI · SLA & ops health", result: "SLA shows as on-track / watch / at-risk for the meeting." },
    ],
    success: ["No applicant sits uncontacted past 24h without appearing on the red list with a named owner."],
    watchFor: ["SMS send-rate via the external texting tool is unmeasurable — don't treat its absence as a miss."],
    related: ["new-applicant", "hot-family"],
  },

  // ─────────────────────────────── Close the loop ───────────────────────────────
  {
    slug: "objection-to-content",
    title: "Turn a family objection into content that resolves it",
    category: "Close the loop",
    objective: "Take a recurring objection from family conversations, brief content to answer it, publish, and confirm the objection drops.",
    who: ["Admissions Owner", "Content Owner"],
    modules: ["Admissions", "Content", "Analytics"],
    trigger: "An objection theme (e.g. 'is my kid gifted enough', cost, accreditation) trends up.",
    steps: [
      { do: "Log/observe the rising objection with its frequency, trend, and verbatim quotes.", where: "Admissions · Objection log", result: "The objection is quantified and tagged by theme + source." },
      { do: "Let the objection auto-create a content brief stub (theme, verbatim, angle, persona, urgency).", where: "Admissions · Objection-to-content bridge → Content", result: "A 'brief from admissions' card appears in the Content pipeline." },
      { do: "Produce and publish the piece through the pipeline.", where: "Content · Production pipeline + Calendar", result: "Content ships against the brief." },
      { do: "Check whether the objection frequency fell and the piece drove conversions.", where: "Admissions · bridge hit-rate + Content · Performance (UTM)", result: "Closed loop: bridge hit-rate up, objection trend down." },
    ],
    success: ["Briefs sent → content produced (bridge hit-rate), and the objection's frequency measurably decreases afterward."],
    watchFor: ["Correlation isn't proof — a drop after publishing is suggestive, not causal; note confounders."],
    related: ["hot-family", "new-applicant"],
  },
  {
    slug: "hot-family",
    title: "Escalate a hot family for fast human follow-up",
    category: "Close the loop",
    objective: "Get a high-intent or at-risk family in front of the right person fast, with full context.",
    who: ["Nurture", "Grassroots", "Admissions", "Leadership"],
    modules: ["Nurture", "Grassroots", "Admissions", "Decision Queue"],
    trigger: "An owner spots a hot signal (an SMS thread, an ambassador tip, an event lead).",
    steps: [
      { do: "Flag the family as hot from the thread or ambassador record.", where: "Nurture · SMS inbox OR Grassroots · roster", result: "A hot-family chip is created with the source context." },
      { do: "See the family surface for the admissions team.", where: "Admissions / VoC", result: "The escalation lands with its history attached — no re-keying." },
      { do: "If it needs a leadership call, it appears in the Decision Queue.", where: "Decision Queue", result: "Leadership can act; the flag is tracked to closure." },
    ],
    success: ["From flag to the Admissions/VoC card in ≤2 clicks, with full context, on mobile."],
    watchFor: ["Family quotes/PII travel with the flag — respect consent and minimize what's shown."],
    related: ["objection-to-content", "raise-a-decision"],
  },

  // ─────────────────────────────── Govern & trust ───────────────────────────────
  {
    slug: "raise-a-decision",
    title: "Raise a decision and get a leadership ruling",
    category: "Govern & trust",
    objective: "Let any owner raise a proposal/decision from their module, and have leadership (only) rule on it — with the right people denied the queue.",
    who: ["Operators (submit)", "Leadership (decide)"],
    modules: ["(any module)", "Decision Queue", "Home"],
    trigger: "An owner needs a call — budget, a sequence, an event, a content concept.",
    steps: [
      { do: "Raise a decision from your module: question, recommendation, optional budget ask, due date, priority.", where: "Any module · Raise flow", result: "The item lands in the Decision Queue and chips onto leadership's Home preview." },
      { do: "(Operator) Track your own submission's status.", where: "Decision Queue · your submissions", result: "You see open → decided → in-flight for items you raised — but cannot view or act on others'." },
      { do: "(Leadership) Review and rule — approve / reject / need-info with a comment.", where: "Decision Queue · Active decisions (Leader-only)", result: "Status + resolution recorded; the submitter is notified." },
    ],
    success: [
      "An Operator who opens the Decision Queue is denied the full queue (route + data + UI all enforce it).",
      "Leadership sees a badge for new decisions and clears them with an auditable history.",
    ],
    watchFor: ["This is the headline access-control surface — non-leaders submit, only leaders view/act."],
    related: ["budget-variance", "hot-family", "weekly-meeting"],
  },
  {
    slug: "budget-variance",
    title: "Catch a budget overrun and reallocate",
    category: "Govern & trust",
    objective: "Spot a workstream going over plan, route it to leadership, reallocate, and keep the budget reconciled to $365K.",
    who: ["Budget Owner", "Workstream owners", "Leadership"],
    modules: ["Budget", "Decision Queue"],
    trigger: "An owner enters committed/actual spend that pushes a workstream >10% over plan.",
    steps: [
      { do: "Enter your workstream's committed and actual spend.", where: "Budget · Budget table", result: "Cumulative + per-workstream totals recompute; burn updates." },
      { do: "See the variance alert auto-flag to the Decision Queue when a workstream exceeds plan by >10%.", where: "Budget · Variance alerts → Decision Queue", result: "A decision item is created automatically with the overrun context." },
      { do: "(Leadership) Approve a reallocation or adjusted plan.", where: "Decision Queue", result: "Planned amounts adjust; the total still reconciles to $365K." },
    ],
    success: ["Any workstream >10% over plan appears in the Decision Queue without manual filing; the grand total always reconciles to $365K."],
    watchFor: ["Summer camp is a separate P&L and does not roll into this budget unless leadership decides otherwise."],
    related: ["raise-a-decision", "gt-challenge"],
  },
  {
    slug: "data-confidence",
    title: "Respond to a data-confidence drop",
    category: "Govern & trust",
    objective: "When Supabase↔HubSpot sync parity falls, understand the banner that appears across modules and resolve the underlying issue.",
    who: ["Marketing Lead"],
    modules: ["CRM Ops", "(all HubSpot-consuming modules)"],
    trigger: "Sync parity drops below threshold (or a field starts drifting).",
    steps: [
      { do: "Notice the data-confidence warning banner on modules that consume HubSpot data.", where: "Any HubSpot-backed module", result: "The banner links to CRM Ops for details — numbers are flagged as possibly mid-drift." },
      { do: "Open the parity view and the auto-detected data-quality issues.", where: "CRM Ops · Sync parity + Data quality queue", result: "Field-level parity + auto-created issues (sync drift, UTM breakage) are listed with severity/owner." },
      { do: "Work the issue to resolution; parity recovers and the banner clears.", where: "CRM Ops · Data quality queue", result: "The fix is logged; banners disappear across modules." },
    ],
    success: ["The banner appears automatically on parity drop and clears automatically on recovery — no manual toggling."],
    watchFor: ["Some HubSpot fields (TEFA, income, source) are known-unreliable by design — app_form is the source of truth for those."],
    related: ["new-applicant", "weekly-meeting"],
  },
  {
    slug: "ask-the-hub",
    title: "Use Ask-the-Hub for a cited operating answer",
    category: "Govern & trust",
    objective:
      "Ask a role-aware AI agent for a business recommendation, inspect the sources and caveats, then route the work to the right module without bypassing Hub controls.",
    who: ["Leadership", "Marketing Lead", "Operators"],
    modules: ["Help", "CRM Ops", "Budget", "Decision Queue", "Open Data", "Dashboard / KPI"],
    trigger: "A user needs a fast answer about pacing, budget, data trust, Open Data, or what to do next.",
    steps: [
      { do: "Open Ask-the-Hub and ask a business question in plain language.", where: "Help · AI agents", result: "The right specialist agent handles the question: growth strategy, data quality, decision support, or operator coaching." },
      { do: "Read the answer, citations, confidence, and caveats before acting.", where: "Help · AI agents · Evidence", result: "Every numeric claim names a source such as Budget ledger, app_form, CRM Ops parity, or Open Data fixture/cache/live." },
      { do: "Follow the recommended action in the named module.", where: "Budget / CRM Ops / Decision Queue / My submissions", result: "The AI advises; governed Hub workflows still perform approvals, edits, and audit trails." },
    ],
    success: [
      "The answer is cited, de-identified, and role-aware.",
      "Operators get coaching and own-submission guidance, not the full Decision Queue.",
      "Unsupported prompts are refused with a safer next step.",
    ],
    watchFor: [
      "Exact CAC-by-channel is refused while UTM attribution is known broken.",
      "Open Data is read-only decision context and must not be written back to family records.",
      "The agents do not reveal raw PII, SMS bodies, child names, or unconsented quotes.",
    ],
    related: ["data-confidence", "raise-a-decision", "budget-variance", "weekly-meeting"],
    fromSpec:
      "Technical Brief optional AI layer — Ask-the-Hub over HubSpot + Supabase + Open Data, with honest refusals and cited evidence.",
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export const CATEGORY_ORDER: GuideCategory[] = [
  "Run the cadence",
  "Grow the funnel",
  "Close the loop",
  "Govern & trust",
  "Personalize",
];

export function guidesByCategory(): { category: GuideCategory; guides: Guide[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    guides: GUIDES.filter((g) => g.category === category),
  })).filter((group) => group.guides.length > 0);
}
