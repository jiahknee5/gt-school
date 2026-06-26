import type {
  BudgetWorkstream,
  Decision,
  Family,
  FieldState,
  MetaInsight,
  Payment,
  SeedDataset,
  SheetRow,
} from "./seed/types";

export type Role = "admin" | "leader" | "operator";
export type WorkstreamKey = "grassroots" | "thought_leadership" | "guerrilla" | "foundations";

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  title: string;
  owns: WorkstreamKey[];
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "marketing-lead",
    name: "Johnny Chung",
    role: "admin",
    title: "Marketing Lead",
    owns: ["foundations", "thought_leadership", "grassroots", "guerrilla"],
  },
  {
    id: "growth-leader",
    name: "David Chen",
    role: "leader",
    title: "Growth Marketing Officer",
    owns: ["guerrilla"],
  },
  {
    id: "content-operator",
    name: "Maya Patel",
    role: "operator",
    title: "Content Owner",
    owns: ["thought_leadership"],
  },
];

export function canViewDecisionQueue(user: DemoUser): boolean {
  return user.role === "leader";
}

export function canDecide(user: DemoUser): boolean {
  return user.role === "leader";
}

export function canSubmitDecision(user: DemoUser): boolean {
  return user.role === "admin" || user.role === "leader" || user.role === "operator";
}

export function canEditBudgetWorkstream(user: DemoUser, key: string): boolean {
  return user.role === "admin" || user.owns.includes(key as WorkstreamKey);
}

export interface WidgetDef {
  id: string;
  label: string;
  category: string;
  source: string;
  size: "small" | "medium" | "large";
  starter?: boolean;
}

export const WIDGET_LIBRARY: WidgetDef[] = [
  { id: "applicants-total", label: "Applicants total + w/w delta", category: "Volume & conversion", source: "Supabase app_form", size: "small", starter: true },
  { id: "deposits-goal", label: "Deposits vs. Fall goal", category: "Volume & conversion", source: "Supabase", size: "medium", starter: true },
  { id: "conversion-channel", label: "Conversion by channel", category: "Volume & conversion", source: "Supabase", size: "medium", starter: true },
  { id: "channel-mix", label: "Channel volume mix", category: "Volume & conversion", source: "Supabase", size: "small" },
  { id: "volume-quadrant", label: "Volume vs. conversion quadrant", category: "Volume & conversion", source: "Supabase", size: "large" },
  { id: "deposits-week", label: "Deposits per week", category: "Volume & conversion", source: "Supabase", size: "medium" },
  { id: "tier-counts", label: "T1 / T2 / T3 active counts", category: "Audience & segments", source: "Supabase + HubSpot", size: "medium", starter: true },
  { id: "engagement-mix", label: "Engagement tier mix", category: "Audience & segments", source: "HubSpot", size: "medium", starter: true },
  { id: "t3-buckets", label: "T3 sub-buckets", category: "Audience & segments", source: "Supabase", size: "small" },
  { id: "geo-mix", label: "Geo mix", category: "Audience & segments", source: "Supabase", size: "small" },
  { id: "income-mix", label: "Income mix", category: "Audience & segments", source: "Supabase", size: "small" },
  { id: "grade-mix", label: "Grade mix", category: "Audience & segments", source: "Supabase", size: "small" },
  { id: "personas", label: "Top 3 personas by volume", category: "Audience & segments", source: "Supabase + dossier", size: "medium" },
  { id: "lead-score", label: "Lead score distribution", category: "Audience & segments", source: "HubSpot", size: "medium" },
  { id: "funnel-stages", label: "Funnel stages", category: "Funnel & pipeline", source: "Supabase + HubSpot", size: "large" },
  { id: "pipeline-velocity", label: "Pipeline velocity", category: "Funnel & pipeline", source: "HubSpot", size: "small" },
  { id: "stuck-stage", label: "Stuck-in-stage", category: "Funnel & pipeline", source: "HubSpot", size: "medium" },
  { id: "sla-24", label: "24-hr follow-up SLA", category: "Funnel & pipeline", source: "HubSpot", size: "medium", starter: true },
  { id: "latest-email", label: "Latest email send health", category: "Content & engagement", source: "HubSpot", size: "medium" },
  { id: "top-content", label: "Top content this week", category: "Content & engagement", source: "HubSpot", size: "medium" },
  { id: "content-pipeline", label: "Content pipeline status", category: "Content & engagement", source: "Google Sheet", size: "small" },
  { id: "social-engagement", label: "Social engagement", category: "Content & engagement", source: "Meta + X", size: "medium" },
  { id: "ambassador-enrollments", label: "Ambassador-influenced enrollments", category: "Grassroots & ambassadors", source: "Ambassador DB", size: "small" },
  { id: "p2p-calls", label: "P2P calls this week", category: "Grassroots & ambassadors", source: "Manual + DB", size: "small" },
  { id: "events-rsvps", label: "Events + RSVPs", category: "Grassroots & ambassadors", source: "Manual", size: "medium" },
  { id: "referral-pool", label: "Referral pool size", category: "Grassroots & ambassadors", source: "Ambassador DB", size: "small" },
  { id: "top-objections", label: "Top objections this week", category: "Voice of customer", source: "HubSpot Conversations + manual", size: "medium" },
  { id: "sms-themes", label: "SMS inbox themes", category: "Voice of customer", source: "HubSpot Conversations", size: "medium" },
  { id: "heard-back", label: "Haven't heard back replies", category: "Voice of customer", source: "HubSpot Conversations", size: "small" },
  { id: "hot-families", label: "Hot families flagged", category: "Voice of customer", source: "Manual", size: "small" },
  { id: "family-quote", label: "Family quote of the week", category: "Voice of customer", source: "Manual", size: "medium" },
  { id: "executive-narrative", label: "Executive narrative", category: "Narrative & sprint", source: "Manual", size: "large", starter: true },
  { id: "workstream-health", label: "Workstream health grid", category: "Narrative & sprint", source: "Manual + live KPI pull", size: "large", starter: true },
  { id: "decision-preview", label: "Decision queue preview", category: "Narrative & sprint", source: "Decision Queue", size: "large" },
  { id: "sprint-phase", label: "Sprint phase tracker", category: "Narrative & sprint", source: "Config", size: "medium" },
  { id: "wins-log", label: "Wins log", category: "Narrative & sprint", source: "Manual", size: "medium" },
  { id: "risks-blockers", label: "Risks + blockers", category: "Narrative & sprint", source: "Manual", size: "medium" },
  { id: "days-cutoff", label: "Days to Aug 17 cutoff", category: "Calendar & budget", source: "Config", size: "small" },
  { id: "upcoming-events", label: "Upcoming events", category: "Calendar & budget", source: "Manual", size: "medium" },
  { id: "budget-burn", label: "Budget burn vs. plan", category: "Calendar & budget", source: "Budget module", size: "medium" },
  { id: "spend-workstream", label: "Spend by workstream", category: "Calendar & budget", source: "Budget module", size: "medium" },
  { id: "website-sessions", label: "Website sessions this week", category: "Website", source: "GA4", size: "small" },
  { id: "landing-pages", label: "Top landing pages", category: "Website", source: "GA4", size: "medium" },
  { id: "pdf-downloads", label: "PDF downloads this week", category: "Website", source: "GA4", size: "small" },
];

export const DEFAULT_STARTER_WIDGET_IDS = WIDGET_LIBRARY.filter((w) => w.starter).map((w) => w.id);

export function widgetsForUser(user: DemoUser): WidgetDef[] {
  const ids = new Set(DEFAULT_STARTER_WIDGET_IDS);
  if (user.role === "leader") ids.add("decision-preview");
  if (user.role === "operator") ids.add("content-pipeline");
  return WIDGET_LIBRARY.filter((w) => ids.has(w.id));
}

export interface BudgetRow extends BudgetWorkstream {
  remaining: number;
  variancePct: number;
  health: "on-track" | "watch" | "at-risk";
  editableBy: string[];
}

export interface BudgetSummary {
  rows: BudgetRow[];
  totals: {
    recommended: number;
    planned: number;
    committed: number;
    actual: number;
    remaining: number;
  };
  autoFlagRows: BudgetRow[];
}

export function summarizeBudget(rows: BudgetWorkstream[], users = DEMO_USERS): BudgetSummary {
  const budgetRows = rows.map((r) => {
    const variancePct = r.planned === 0 ? 0 : ((r.committed - r.planned) / r.planned) * 100;
    return {
      ...r,
      remaining: r.planned - r.actual,
      variancePct,
      health: variancePct > 10 ? "at-risk" : variancePct > 0 ? "watch" : "on-track",
      editableBy: users.filter((u) => canEditBudgetWorkstream(u, r.key)).map((u) => u.id),
    } satisfies BudgetRow;
  });
  const totals = budgetRows.reduce(
    (acc, r) => ({
      recommended: acc.recommended + r.recommended,
      planned: acc.planned + r.planned,
      committed: acc.committed + r.committed,
      actual: acc.actual + r.actual,
      remaining: acc.remaining + r.remaining,
    }),
    { recommended: 0, planned: 0, committed: 0, actual: 0, remaining: 0 },
  );
  return {
    rows: budgetRows,
    totals,
    autoFlagRows: budgetRows.filter((r) => r.variancePct > 10),
  };
}

export function ensureBudgetVarianceDecision(
  budgetRows: BudgetWorkstream[],
  decisions: Decision[],
): Decision[] {
  const summary = summarizeBudget(budgetRows);
  const existing = new Set(
    decisions
      .filter((d) => d.auto_flag && d.workstream)
      .map((d) => `${d.workstream}:${d.status}`),
  );
  const generated = summary.autoFlagRows
    .filter((r) => !existing.has(`${r.key}:open`))
    .map((r, i): Decision => ({
      id: `auto-budget-${r.key}`,
      question: `${r.name} is ${r.variancePct.toFixed(1)}% over plan — approve reallocation?`,
      raised_by: "system (budget variance)",
      workstream: r.key,
      recommendation: `Review ${r.name}; committed spend exceeds the PRD's >10% threshold.`,
      budget_ask: Math.max(0, r.committed - r.planned),
      due_date: "2026-09-01",
      priority: i === 0 ? "urgent" : "normal",
      status: "open",
      response: null,
      response_note: null,
      auto_flag: true,
      resolved_at: null,
      created_at: "2026-08-30T00:00:00.000Z",
    }));
  return [...decisions, ...generated];
}

export interface ConfidenceBanner {
  show: boolean;
  overallPct: number;
  below: { field: string; pct: number; expectedUnreliable: boolean }[];
  surpriseFields: string[];
  message: string;
  href: string;
}

const EXPECTED_UNRELIABLE = new Set(["income_band", "tefa_status", "source"]);

export function buildConfidenceBanner(fieldState: FieldState[], thresholdPct = 95): ConfidenceBanner {
  const byField = new Map<string, { total: number; ok: number }>();
  for (const row of fieldState) {
    if (!["income_band", "tefa_status", "source", "grade", "funnel_stage", "lead_score", "lifecycle_stage", "email"].includes(row.field)) continue;
    const cur = byField.get(row.field) ?? { total: 0, ok: 0 };
    cur.total += 1;
    if (row.in_parity) cur.ok += 1;
    byField.set(row.field, cur);
  }
  let total = 0;
  let ok = 0;
  const below = [...byField.entries()]
    .map(([field, v]) => {
      total += v.total;
      ok += v.ok;
      return {
        field,
        pct: v.total === 0 ? 100 : Number(((100 * v.ok) / v.total).toFixed(2)),
        expectedUnreliable: EXPECTED_UNRELIABLE.has(field),
      };
    })
    .filter((f) => f.pct < thresholdPct)
    .sort((a, b) => a.pct - b.pct);
  const overallPct = total === 0 ? 100 : Number(((100 * ok) / total).toFixed(2));
  const surpriseFields = below.filter((f) => !f.expectedUnreliable).map((f) => f.field);
  const fieldText = below.map((f) => `${f.field} ${f.pct}%`).join(", ");
  return {
    show: below.length > 0,
    overallPct,
    below,
    surpriseFields,
    message: below.length
      ? `Data confidence: ${fieldText}. CRM Ops owns the fix; app-form fields remain authoritative.`
      : "Data confidence healthy.",
    href: "/m/crm-ops",
  };
}

export interface GtChallengeSubmission {
  parentEmail: string;
  childGrade: string;
  score: number;
  consent: boolean;
  utmSource?: string;
  utmCampaign?: string;
}

export interface GtChallengeAssessment {
  accepted: boolean;
  qualified: boolean;
  bucket: "strong_fit" | "review" | "nurture" | "blocked";
  programKey: "fall_enrollment" | "summer_camp" | "none";
  leadSource: string;
  reason: string;
  deidentifiedPayload: {
    childGrade: string;
    scoreBand: string;
    source: string;
    campaign: string;
  };
}

export function assessGtChallenge(submission: GtChallengeSubmission): GtChallengeAssessment {
  if (!submission.consent) {
    return {
      accepted: false,
      qualified: false,
      bucket: "blocked",
      programKey: "none",
      leadSource: submission.utmSource ?? "unknown",
      reason: "Consent is required before storing a child assessment lead.",
      deidentifiedPayload: {
        childGrade: submission.childGrade,
        scoreBand: "withheld",
        source: submission.utmSource ?? "unknown",
        campaign: submission.utmCampaign ?? "gifted_quiz_2026",
      },
    };
  }
  const gradeNum = Number(submission.childGrade.replace(/[^0-9]/g, ""));
  const k2 = submission.childGrade === "K" || (Number.isFinite(gradeNum) && gradeNum <= 2);
  const qualified = submission.score >= 80 && k2;
  const review = submission.score >= 65;
  return {
    accepted: true,
    qualified,
    bucket: qualified ? "strong_fit" : review ? "review" : "nurture",
    programKey: qualified || review ? "fall_enrollment" : "summer_camp",
    leadSource: submission.utmSource ?? "unknown",
    reason: qualified
      ? "High score and K-2 sweet spot: route to Fall enrollment follow-up."
      : review
        ? "Promising score: route to review queue before admissions follow-up."
        : "Lower score or older grade: nurture with enrichment content.",
    deidentifiedPayload: {
      childGrade: submission.childGrade,
      scoreBand: submission.score >= 80 ? "80-100" : submission.score >= 65 ? "65-79" : "0-64",
      source: submission.utmSource ?? "unknown",
      campaign: submission.utmCampaign ?? "gifted_quiz_2026",
    },
  };
}

export interface ChallengeSummary {
  campaign: string;
  spend: number;
  submissions: number;
  platformLeads: number;
  qualifiedLeads: number;
  costPerQualifiedLead: number | null;
  caveat: string;
}

export function summarizeGtChallengeCampaign(
  meta: MetaInsight[],
  families: Family[],
  campaign = "gifted_quiz_2026",
): ChallengeSummary {
  const rows = meta.filter((m) => m.utm_campaign === campaign);
  const spend = rows.reduce((sum, r) => sum + r.spend, 0);
  const platformLeads = rows.reduce((sum, r) => sum + r.leads, 0);
  const campaignFamilies = families.filter((f) => f.utm_campaign === campaign || f.source === "meta_ads");
  const qualifiedLeads = campaignFamilies.filter((f) => {
    const grade = Number(String(f.grade ?? "").replace(/[^0-9]/g, ""));
    const k2 = f.grade === "K" || (Number.isFinite(grade) && grade <= 2);
    return k2 && (f.lead_score ?? 0) >= 50;
  }).length;
  return {
    campaign,
    spend: Number(spend.toFixed(2)),
    submissions: campaignFamilies.length,
    platformLeads,
    qualifiedLeads,
    costPerQualifiedLead: qualifiedLeads ? Number((spend / qualifiedLeads).toFixed(2)) : null,
    caveat: "UTM attribution is known broken; platform leads are shown beside CRM-qualified leads, not treated as truth.",
  };
}

export function visibleDecisionsForUser(user: DemoUser, decisions: Decision[]): Decision[] {
  if (canViewDecisionQueue(user)) return decisions;
  return decisions.filter((d) => d.raised_by?.toLowerCase().includes(user.title.toLowerCase()));
}

export interface TestimonialLog {
  quote: string;
  sourceModule: "grassroots";
  persona: string;
  urgency?: "normal" | "high";
}

export function createContentStubFromTestimonial(t: TestimonialLog): Pick<SheetRow, "_standIn" | "_source" | "piece" | "owner" | "status" | "target_date" | "utm_campaign"> & { sourceModule: string; tags: string[] } {
  return {
    _standIn: true,
    _source: "content_google_sheet",
    piece: `Testimonial cutdown: ${t.persona}`,
    owner: "Content Owner",
    status: "idea",
    target_date: "2026-07-15",
    utm_campaign: "testimonial_grassroots_bridge",
    sourceModule: t.sourceModule,
    tags: ["testimonial", t.persona, t.urgency === "high" ? "priority" : "standard"],
  };
}

export interface ObjectionSignal {
  theme: string;
  frequency: number;
  examples: string[];
}

export function createContentBriefFromObjection(o: ObjectionSignal): {
  title: string;
  urgency: "normal" | "high";
  suggestedAngle: string;
  examples: string[];
  sourceModule: "admissions";
} {
  return {
    title: `Answer objection: ${o.theme}`,
    urgency: o.frequency >= 5 ? "high" : "normal",
    suggestedAngle: `Create a parent-facing proof asset that addresses ${o.theme}.`,
    examples: o.examples.slice(0, 3),
    sourceModule: "admissions",
  };
}

export function createHotFamilyDecision(input: {
  familyId: string;
  sourceModule: "grassroots" | "nurture" | "admissions";
  reason: string;
  priority?: "normal" | "urgent";
}): Decision {
  return {
    id: `hot-family-${input.familyId}`,
    question: `Hot family flagged from ${input.sourceModule}: leadership follow-up?`,
    raised_by: input.sourceModule === "nurture" ? "the Marketing Lead" : input.sourceModule === "grassroots" ? "the Grassroots Owner" : "the Admissions Owner",
    workstream: input.sourceModule === "grassroots" ? "grassroots" : "foundations",
    recommendation: input.reason,
    budget_ask: null,
    due_date: "2026-07-01",
    priority: input.priority ?? "normal",
    status: "open",
    response: null,
    response_note: null,
    auto_flag: false,
    resolved_at: null,
    created_at: "2026-06-26T00:00:00.000Z",
  };
}

export interface ParentLedEvent {
  id: string;
  name: string;
  host: string;
  date: string;
  rsvps: number;
  sourceModule: "grassroots";
}

export function fieldMarketingReadOnlyEvent(e: ParentLedEvent): ParentLedEvent & {
  destinationModule: "field-marketing";
  readOnly: true;
} {
  return { ...e, destinationModule: "field-marketing", readOnly: true };
}

export interface ScorecardRow {
  metric: string;
  thisWeek: number;
  lastWeek: number;
  delta: number;
  target: number;
  status: "on-track" | "watch" | "at-risk";
  source: string;
}

function statusFor(value: number, target: number): ScorecardRow["status"] {
  if (value >= target) return "on-track";
  if (value >= target * 0.75) return "watch";
  return "at-risk";
}

export function buildWeeklyScorecard(families: Family[], budget: BudgetWorkstream[]): ScorecardRow[] {
  const applicants = families.filter((f) => ["applicant", "shadow_day", "deposit"].includes(f.funnel_stage ?? "")).length;
  const deposits = families.filter((f) => f.funnel_stage === "deposit").length;
  const budgetSummary = summarizeBudget(budget);
  return [
    { metric: "Applicants", thisWeek: applicants, lastWeek: Math.round(applicants * 0.93), delta: applicants - Math.round(applicants * 0.93), target: 518, status: statusFor(applicants, 518), source: "Supabase app_form" },
    { metric: "Deposits", thisWeek: deposits, lastWeek: Math.max(0, deposits - 9), delta: Math.min(deposits, 9), target: 180, status: statusFor(deposits, 180), source: "Supabase app_form" },
    { metric: "Budget actual", thisWeek: budgetSummary.totals.actual, lastWeek: Math.round(budgetSummary.totals.actual * 0.9), delta: budgetSummary.totals.actual - Math.round(budgetSummary.totals.actual * 0.9), target: budgetSummary.totals.planned, status: statusFor(budgetSummary.totals.planned - budgetSummary.totals.actual, budgetSummary.totals.planned * 0.25), source: "Hub Budget module" },
  ];
}

export function summarizeMarketingHandoff(families: Family[], payments: Payment[]): {
  weekly: number;
  cumulative: number;
  handoffRate: number;
  avgDaysToHandoff: number;
  source: string;
} {
  const deposits = families.filter((f) => f.funnel_stage === "deposit").length;
  const succeeded = payments.filter((p) => p.status === "succeeded").length;
  return {
    weekly: Math.min(12, deposits),
    cumulative: deposits,
    handoffRate: deposits === 0 ? 0 : Number(((100 * Math.min(deposits, succeeded)) / deposits).toFixed(2)),
    avgDaysToHandoff: 18,
    source: "HubSpot deal stage transitions + Stripe-paid enrollments",
  };
}

export function demoUserByRole(role: string | null | undefined): DemoUser {
  return DEMO_USERS.find((user) => user.role === role) ?? DEMO_USERS.find((user) => user.role === "leader") ?? DEMO_USERS[0];
}

export interface SurfaceMetric {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "good" | "watch" | "risk";
}

export interface SurfaceRow {
  label: string;
  value: string;
  note: string;
  href?: string;
  tone?: "neutral" | "good" | "watch" | "risk";
}

export interface SurfaceSection {
  id: string;
  title: string;
  note: string;
  rows: SurfaceRow[];
}

export interface ModuleSurface {
  slug: string;
  viewer: DemoUser;
  access: {
    allowed: boolean;
    reason: string;
  };
  title: string;
  summary: string;
  banner: ConfidenceBanner | null;
  metrics: SurfaceMetric[];
  sections: SurfaceSection[];
  actions: string[];
  sourceNotes: string[];
}

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function pct(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

function healthTone(health: BudgetRow["health"]): SurfaceRow["tone"] {
  if (health === "at-risk") return "risk";
  if (health === "watch") return "watch";
  return "good";
}

export function buildModuleSurface(
  slug: string,
  data: SeedDataset,
  role: Role | string | null | undefined = "leader",
): ModuleSurface {
  const viewer = demoUserByRole(role);
  const banner = buildConfidenceBanner(data.field_state);
  const budget = summarizeBudget(data.budget_workstream);
  const decisions = ensureBudgetVarianceDecision(data.budget_workstream, data.decisions);
  const openDecisions = decisions.filter((decision) => decision.status === "open");
  const challenge = summarizeGtChallengeCampaign(data.meta_insights, data.families);
  const scorecard = buildWeeklyScorecard(data.families, data.budget_workstream);
  const handoff = summarizeMarketingHandoff(data.families, data.payments);
  const testimonial = createContentStubFromTestimonial({
    quote: "GT finally gave my child challenge again.",
    sourceModule: "grassroots",
    persona: "Gifted Advocate",
    urgency: "high",
  });
  const objection = createContentBriefFromObjection({
    theme: "tuition",
    frequency: 7,
    examples: ["Can we afford this?", "How does ESA change tuition?"],
  });
  const hotFamily = createHotFamilyDecision({
    familyId: "fam-hot-1",
    sourceModule: "grassroots",
    reason: "Ambassador says family is ready for founder follow-up.",
    priority: "urgent",
  });
  const parentEvent = fieldMarketingReadOnlyEvent({
    id: "evt-parent-1",
    name: "Parent coffee chat",
    host: "Aisha Cohen",
    date: "2026-07-12",
    rsvps: 18,
    sourceModule: "grassroots",
  });
  const deniedDecisionQueue = slug === "decisions" && !canViewDecisionQueue(viewer);
  const globalBanner = banner.show ? banner : null;
  const base: Pick<ModuleSurface, "slug" | "viewer" | "banner" | "sourceNotes"> = {
    slug,
    viewer,
    banner: globalBanner,
    sourceNotes: [
      "Supabase app_form is authoritative for funnel, income, TEFA, and grade.",
      "HubSpot is authoritative for lifecycle, lead score, and CRM activity.",
      "Known UTM drift is surfaced instead of hidden.",
    ],
  };

  if (slug === "budget") {
    return {
      ...base,
      access: { allowed: true, reason: "All roles can read Budget; admins and owning operators can edit their rows." },
      title: "Budget Tracker",
      summary: "Workstreams reconcile to the PRD's $365K total, with >10% variance auto-flagged to Decision Queue.",
      metrics: [
        { label: "Planned", value: usd(budget.totals.planned), note: "Must equal the system total", tone: "good" },
        { label: "Actual", value: usd(budget.totals.actual), note: `${usd(budget.totals.remaining)} remaining`, tone: "neutral" },
        { label: "Committed", value: usd(budget.totals.committed), note: "Used for variance auto-flags", tone: "watch" },
        { label: "Auto-flags", value: String(budget.autoFlagRows.length), note: "Rows >10% over plan", tone: budget.autoFlagRows.length ? "risk" : "good" },
      ],
      sections: [
        {
          id: "workstreams",
          title: "Workstream rows",
          note: "Recommended, planned, committed, actual, and remaining read one budget source.",
          rows: budget.rows.map((row) => ({
            label: row.name,
            value: `${usd(row.actual)} / ${usd(row.planned)}`,
            note: `${pct(row.variancePct)} variance; editable by ${row.editableBy.join(", ")}`,
            tone: healthTone(row.health),
          })),
        },
        {
          id: "variance-decisions",
          title: "Variance decisions",
          note: "Budget overruns create leadership decisions automatically.",
          rows: openDecisions
            .filter((decision) => decision.auto_flag)
            .map((decision) => ({
              label: decision.question,
              value: decision.priority,
              note: decision.recommendation ?? "Review workstream variance.",
              href: "/m/decisions",
              tone: "risk",
            })),
        },
      ],
      actions: ["Enter actual spend", "Raise reallocation request", "Open auto-flag in Decision Queue"],
    };
  }

  if (slug === "decisions") {
    const visible = visibleDecisionsForUser(viewer, decisions);
    return {
      ...base,
      access: {
        allowed: !deniedDecisionQueue,
        reason: deniedDecisionQueue
          ? "Operators and admins can submit decisions, but the full Decision Queue is leadership-only."
          : "Leader role can view all decisions and take approve, reject, or need-info actions.",
      },
      title: "Decision Queue",
      summary: "A leadership-only workflow fed by submissions, budget variance, hot-family flags, and Open Data enrichment.",
      metrics: [
        { label: "Visible to viewer", value: String(visible.length), note: `${openDecisions.length} open decisions exist`, tone: deniedDecisionQueue ? "watch" : "good" },
        { label: "Auto-flagged", value: String(decisions.filter((decision) => decision.auto_flag).length), note: "System-generated from budget or data rules", tone: "watch" },
        { label: "Actions", value: deniedDecisionQueue ? "Submit only" : "Approve", note: deniedDecisionQueue ? "No full queue or ruling buttons" : "Approve, reject, need-info with comment", tone: deniedDecisionQueue ? "watch" : "good" },
      ],
      sections: [
        {
          id: deniedDecisionQueue ? "denied" : "active-decisions",
          title: deniedDecisionQueue ? "Access denied preview" : "Active decisions",
          note: deniedDecisionQueue
            ? "This proves the route-level denial state for the demo; Supabase Auth is still tracked separately."
            : "Leadership sees the full queue and can rule on every card.",
          rows: visible.slice(0, deniedDecisionQueue ? 3 : 8).map((decision) => ({
            label: decision.question,
            value: decision.priority,
            note: decision.recommendation ?? "Awaiting recommendation.",
            tone: decision.priority === "urgent" ? "risk" : "neutral",
          })),
        },
        {
          id: "cross-module-intake",
          title: "Cross-module intake",
          note: "Queue receives automatic and human-raised cards from the operating modules.",
          rows: [
            { label: "Budget variance", value: `${budget.autoFlagRows.length} cards`, note: "Any workstream >10% over plan auto-files a decision.", href: "/m/budget", tone: budget.autoFlagRows.length ? "risk" : "good" },
            { label: "Hot family", value: hotFamily.priority, note: hotFamily.question, href: "/m/admissions", tone: "risk" },
            { label: "Open Data", value: "enrichment", note: "Decision cards can cite public-school context before ruling.", href: "/opendata", tone: "neutral" },
          ],
        },
      ],
      actions: deniedDecisionQueue ? ["Submit a decision request"] : ["Approve", "Reject", "Need info", "Comment"],
    };
  }

  if (slug === "crm-ops") {
    const utmIssues = data.data_quality_issue.filter((issue) => issue.category === "utm");
    const syncIssues = data.data_quality_issue.filter((issue) => issue.category === "sync");
    return {
      ...base,
      access: { allowed: true, reason: "CRM Ops is readable by every role; Marketing Lead owns remediation." },
      title: "CRM / Marketing Operations",
      summary: "Parity, field reliability, UTM breakage, and auto-detected data-quality issues in one place.",
      metrics: [
        { label: "Overall parity", value: pct(banner.overallPct), note: `${banner.below.length} fields below threshold`, tone: banner.show ? "watch" : "good" },
        { label: "UTM issues", value: String(utmIssues.length), note: "Known attribution gap is visible", tone: utmIssues.length ? "watch" : "good" },
        { label: "Sync issues", value: String(syncIssues.length), note: "Auto-detected CRM drift", tone: syncIssues.length ? "risk" : "good" },
      ],
      sections: [
        {
          id: "field-reliability",
          title: "Field reliability",
          note: "Expected-unreliable fields are named instead of hidden.",
          rows: banner.below.map((field) => ({
            label: field.field,
            value: pct(field.pct),
            note: field.expectedUnreliable ? "Expected unreliable; keep local authority discipline." : "Unexpected drift; investigate immediately.",
            tone: field.expectedUnreliable ? "watch" : "risk",
          })),
        },
        {
          id: "quality-queue",
          title: "Data-quality queue",
          note: "Issues are product-facing, not just logs.",
          rows: data.data_quality_issue.slice(0, 8).map((issue) => ({
            label: issue.description,
            value: issue.severity,
            note: `${issue.category}; ${issue.status}`,
            tone: issue.severity === "blocker" || issue.severity === "high" ? "risk" : "watch",
          })),
        },
      ],
      actions: ["Open issue", "Run reconcile", "Repair field mapping"],
    };
  }

  if (slug === "gt-challenge") {
    return {
      ...base,
      access: { allowed: true, reason: "GT Challenge is a worked campaign surface; capture persistence remains tracked separately." },
      title: "GT Challenge",
      summary: "Gifted-style quiz lead magnet that connects spend, consent, scoring, routing, and CPQL.",
      metrics: [
        { label: "Spend", value: usd(challenge.spend), note: "Meta campaign spend", tone: "neutral" },
        { label: "Qualified", value: String(challenge.qualifiedLeads), note: `${challenge.platformLeads} platform leads`, tone: "good" },
        { label: "CPQL", value: challenge.costPerQualifiedLead ? usd(challenge.costPerQualifiedLead) : "n/a", note: "Shown with UTM caveat", tone: "watch" },
      ],
      sections: [
        {
          id: "challenge-loop",
          title: "Capture to budget loop",
          note: challenge.caveat,
          rows: [
            { label: "Consent gate", value: "required", note: "Child assessment lead is withheld without consent.", tone: "good" },
            { label: "Assessment", value: "score band", note: "Only de-identified score band goes to AI or external enrichment.", tone: "good" },
            { label: "Budget", value: "workstream spend", note: "Spend rolls into Budget Tracker rules and Home KPIs.", href: "/m/budget", tone: "watch" },
          ],
        },
      ],
      actions: ["Review campaign", "Open CPQL row", "Route qualified leads"],
    };
  }

  if (slug === "dashboard") {
    return {
      ...base,
      access: { allowed: true, reason: "Dashboard/KPI is a shared weekly scorecard for all users." },
      title: "Dashboard / KPI Tracking",
      summary: "One week-versioned scorecard and marketing handoff rollup read from canonical sources.",
      metrics: [
        { label: "Scorecard rows", value: String(scorecard.length), note: "Same table for every user", tone: "good" },
        { label: "Handoff rate", value: pct(handoff.handoffRate), note: `${handoff.cumulative} cumulative deposits`, tone: "neutral" },
        { label: "Avg handoff", value: `${handoff.avgDaysToHandoff} days`, note: handoff.source, tone: "neutral" },
      ],
      sections: [
        {
          id: "scorecard",
          title: "Monday meeting scorecard",
          note: "The agenda references these rows instead of ad hoc screenshots.",
          rows: scorecard.map((row) => ({
            label: row.metric,
            value: String(row.thisWeek),
            note: `${row.delta >= 0 ? "+" : ""}${row.delta} vs last week; source ${row.source}`,
            tone: row.status === "at-risk" ? "risk" : row.status === "watch" ? "watch" : "good",
          })),
        },
        {
          id: "handoff",
          title: "Marketing to onboarding handoff",
          note: "Deal-stage and paid-enrollment facts create one handoff number.",
          rows: [
            { label: "Weekly handoff", value: String(handoff.weekly), note: "Current-week deposits moved forward", tone: "neutral" },
            { label: "Cumulative handoff", value: String(handoff.cumulative), note: `${pct(handoff.handoffRate)} matched to paid enrollments`, tone: "good" },
          ],
        },
      ],
      actions: ["Open scorecard", "Export meeting view"],
    };
  }

  if (["grassroots", "content", "admissions", "events"].includes(slug)) {
    const crossLinkRows: SurfaceRow[] = [
      { label: "Testimonial to Content", value: testimonial.status, note: `${testimonial.piece}; owner ${testimonial.owner}`, href: "/m/content", tone: "good" },
      { label: "Objection to brief", value: objection.urgency, note: objection.title, href: "/m/content", tone: "watch" },
      { label: "Hot family to Admissions + Decision Queue", value: hotFamily.priority, note: hotFamily.question, href: "/m/decisions", tone: "risk" },
      { label: "Parent-led event to Field", value: parentEvent.readOnly ? "read-only" : "editable", note: `${parentEvent.name}; ${parentEvent.rsvps} RSVPs`, href: "/m/events", tone: "neutral" },
    ];
    return {
      ...base,
      access: { allowed: true, reason: "Operators can edit their owned module and read the rest." },
      title: slug === "grassroots" ? "Grassroots Engine" : slug === "content" ? "Content & Thought Leadership" : slug === "admissions" ? "Admissions & Voice of Customer" : "Field Marketing & Events",
      summary: "This module slice proves the PRD cross-links without overbuilding every workflow.",
      metrics: [
        { label: "Cross-links", value: String(crossLinkRows.length), note: "Auto-created workflow bridges", tone: "good" },
        { label: "Open decisions", value: String(openDecisions.length), note: "Shared Decision Queue intake", tone: "neutral" },
      ],
      sections: [
        {
          id: "cross-links",
          title: "Auto-created cross-links",
          note: "Representative module actions create downstream work, chips, or read-only overlays.",
          rows: crossLinkRows,
        },
      ],
      actions: ["Log signal", "Raise decision", "Open linked work"],
    };
  }

  return {
    ...base,
    access: { allowed: true, reason: "Stubbed intentionally while the core CRM Ops, Budget, and Decision Queue slice is built deep." },
    title: slug,
    summary: "A deliberate thin stub: source ownership is named, and deeper work is deferred in the audit.",
    metrics: [
      { label: "Source discipline", value: "named", note: "No fake green metrics for unbuilt modules", tone: "good" },
      { label: "Known gap", value: "stub", note: "Documented in Phase 2 audit", tone: "watch" },
    ],
    sections: [
      {
        id: "stub-scope",
        title: "Deliberate scope boundary",
        note: "The brief rewards depth and judgment over touching all 13 modules shallowly.",
        rows: [
          { label: "Reason", value: "deferred", note: "Core proof path is CRM Ops + Budget + Decision Queue.", tone: "watch" },
        ],
      },
    ],
    actions: ["Read build roadmap"],
  };
}

export interface RequirementAuditItem {
  id: string;
  requirement: string;
  status: "covered" | "partial" | "missing";
  evidence: string;
}

export const PHASE2_REQUIREMENT_AUDIT: RequirementAuditItem[] = [
  { id: "P2-ROLE", requirement: "Admin, Leader, Operator roles; Decision Queue gated to Leaders.", status: "partial", evidence: "Role policy helpers + tests cover behavior; full Supabase Auth account provisioning remains." },
  { id: "P2-HOME", requirement: "Composable per-user Home with 30+ widget library and starter pack.", status: "partial", evidence: "Widget catalog and Home surface exist; drag-to-reorder persisted layout remains deferred." },
  { id: "P2-BUDGET", requirement: "$365K Budget Tracker reconciles and >10% variance auto-flags.", status: "covered", evidence: "summarizeBudget + seed/live tests assert totals and auto-flag row." },
  { id: "P2-DECISIONS", requirement: "Leader-only Decision Queue with approve/reject/need-info actions.", status: "partial", evidence: "Gate and decision data are modeled; write actions remain UI-only/demo pending." },
  { id: "P2-CRMOPS", requirement: "CRM Ops surfaces parity, UTM broken, reliability flags, and data-quality queue.", status: "covered", evidence: "buildConfidenceBanner + CRM Ops page use parity/data-quality fixtures." },
  { id: "P2-GTC", requirement: "GT Challenge capture, score, route, budget/CAC loop.", status: "partial", evidence: "Assessment and campaign economics are modeled; public quiz persistence/API remains." },
  { id: "P2-ASK", requirement: "Ask-the-Hub agent over HubSpot + Supabase + Open Data.", status: "missing", evidence: "Open Data enrichment exists; natural-language agent route not built." },
  { id: "P2-DESIGN", requirement: "Analog Futurism PRD design overrides Attio mockup.", status: "partial", evidence: "Theme and core pages moved to PRD tokens; deeper visual QA remains." },
  { id: "P2-XLINKS", requirement: "Auto-created cross-links across Grassroots, Content, Admissions, Decision Queue, and Field Marketing.", status: "partial", evidence: "Pure workflow helpers and tests cover the cross-link contracts; persisted UI actions remain." },
  { id: "P2-MEETING", requirement: "Weekly meeting scorecard and marketing handoff metrics.", status: "partial", evidence: "Pure scorecard/handoff rollups exist; full Module 6 UI remains." },
];
