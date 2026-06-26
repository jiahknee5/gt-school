import {
  DEMO_USERS,
  buildConfidenceBanner,
  buildWeeklyScorecard,
  summarizeBudget,
  summarizeGtChallengeCampaign,
  type Role,
} from "@/lib/phase2";
import { activeDecisions, decisionStats, visibleToRole } from "@/lib/decisions/queries";
import {
  enrichDecisionByCounties,
  recommendationImpactFromEnrichment,
  type DecisionEnrichment,
} from "@/lib/opendata/enrich";
import { generate } from "@/lib/seed/generate";
import type { Decision, Family, SeedDataset } from "@/lib/seed/types";

export type AgentId =
  | "growth-strategist"
  | "data-quality-analyst"
  | "decision-support-analyst"
  | "operator-coach";

export type AnswerMode = "deterministic" | "llm-ready";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  businessUser: string;
  objective: string;
  canAnswer: string[];
  refuses: string[];
}

export interface Citation {
  id: string;
  title: string;
  source: string;
  href: string;
  excerpt: string;
}

export interface AskHubRequest {
  question: string;
  role: Role;
  userTitle?: string;
}

export interface AskHubAnswer {
  agent: AgentDefinition;
  mode: AnswerMode;
  question: string;
  answer: string;
  confidence: "low" | "medium" | "high";
  citations: Citation[];
  actions: string[];
  refused?: {
    reason: string;
    saferAlternative: string;
  };
  warnings: string[];
}

export interface HubSnapshot {
  dataset: SeedDataset;
  applicants: number;
  deposits: number;
  depositGoal: number;
  budgetActual: number;
  budgetPlanned: number;
  budgetVarianceWorkstreams: string[];
  dataConfidence: ReturnType<typeof buildConfidenceBanner>;
  challenge: ReturnType<typeof summarizeGtChallengeCampaign>;
  decisions: Decision[];
  visibleDecisions: Decision[];
  decisionStats: ReturnType<typeof decisionStats>;
  topChannels: ChannelSignal[];
  openData: DecisionEnrichment;
  openDataImpact: ReturnType<typeof recommendationImpactFromEnrichment>;
}

export interface BuildSnapshotOptions {
  dataset?: SeedDataset;
  role?: Role;
  userTitle?: string;
  enrichment?: DecisionEnrichment;
}

export interface ChannelSignal {
  source: string;
  applicants: number;
  deposits: number;
  conversionPct: number;
}

interface KnowledgeDoc {
  id: string;
  title: string;
  source: string;
  href: string;
  roles: Role[];
  tags: string[];
  text: string;
}

export const AGENT_ROSTER: AgentDefinition[] = [
  {
    id: "growth-strategist",
    name: "Growth Strategy Agent",
    businessUser: "Leadership and Marketing Lead",
    objective: "Recommend where GT should spend attention and budget to reach 180 deposits without pretending broken attribution is clean.",
    canAnswer: [
      "Which channel or workstream deserves the next experiment?",
      "How does GT Challenge performance compare with funnel and budget goals?",
      "What should the Monday meeting focus on first?",
    ],
    refuses: [
      "Exact CAC-by-channel when UTM attribution is broken.",
      "Personally identifying family lists or child-level targeting.",
    ],
  },
  {
    id: "data-quality-analyst",
    name: "Data Quality Agent",
    businessUser: "Marketing Lead and CRM Ops",
    objective: "Explain whether a number is trustworthy, which source owns it, and what CRM Ops should fix next.",
    canAnswer: [
      "Why is the data-confidence banner showing?",
      "Which fields are app-form authoritative vs HubSpot authoritative?",
      "Can I use this number in a leadership decision?",
    ],
    refuses: [
      "Treating known-unreliable HubSpot fields as truth.",
      "Hiding fixture/cache/source caveats.",
    ],
  },
  {
    id: "decision-support-analyst",
    name: "Decision Support Agent",
    businessUser: "Leadership",
    objective: "Prepare a cited decision brief using Hub data, budget stakes, and Open Data context before a Leader rules.",
    canAnswer: [
      "Should we approve a field or grassroots bet?",
      "What budget is at stake in the open queue?",
      "Did Open Data change the recommendation?",
    ],
    refuses: [
      "Making the decision automatically for leadership.",
      "Using Open Data as a lead field or writing it back to family records.",
    ],
  },
  {
    id: "operator-coach",
    name: "Operator Coach Agent",
    businessUser: "Content, Grassroots, Field, and Admissions operators",
    objective: "Tell operators exactly where to work, what they can edit, and when to submit a leadership ask.",
    canAnswer: [
      "How do I raise a decision if I cannot view the queue?",
      "What should my module owner update before the meeting?",
      "Where do I find the status of my own submissions?",
    ],
    refuses: [
      "Showing the full Decision Queue to non-leaders.",
      "Exposing SMS, phone, email, or child-level PII.",
    ],
  },
];

export const AI_AGENT_SAMPLE_QUESTIONS = [
  "What should leadership focus on in Monday's marketing meeting?",
  "Can we trust CAC by channel right now?",
  "Did Open Data change the Austin + Dallas field bet?",
  "As an operator, how do I raise a decision and track it?",
];

const KNOWLEDGE_BASE: KnowledgeDoc[] = [
  {
    id: "prd-source-of-truth",
    title: "Source-of-truth rule",
    source: "GT Technical Project Brief",
    href: "/help/data-confidence",
    roles: ["admin", "leader", "operator"],
    tags: ["source", "truth", "hubspot", "supabase", "funnel", "income", "grade", "cac"],
    text:
      "Supabase app_form is authoritative for funnel, TEFA, income, and grade. HubSpot fields for TEFA, income, and source are known unreliable; disagreement is a parity issue, not a reason to overwrite app data.",
  },
  {
    id: "prd-decision-queue",
    title: "Decision Queue access rule",
    source: "GT Marketing Hub Spec §11",
    href: "/help/raise-a-decision",
    roles: ["admin", "leader", "operator"],
    tags: ["decision", "queue", "operator", "leader", "submit", "approve", "reject"],
    text:
      "Operators may submit decisions from their modules and track their own submissions. Only the Leader role may view and act on the full Decision Queue.",
  },
  {
    id: "prd-budget",
    title: "Budget reconciliation rule",
    source: "GT Marketing Hub Spec Module 10",
    href: "/help/budget-variance",
    roles: ["admin", "leader", "operator"],
    tags: ["budget", "365k", "variance", "workstream", "reallocate", "decision"],
    text:
      "The Budget Tracker is the source of truth for planned, committed, actual, and remaining spend. Workstreams must reconcile to the $365K total; more than 10% variance auto-flags to the Decision Queue.",
  },
  {
    id: "prd-opendata",
    title: "Open Data decision context",
    source: "GT Technical Project Brief",
    href: "/api/opendata/decision-enrichment?counties=TRAVIS,DALLAS",
    roles: ["admin", "leader"],
    tags: ["open data", "tea", "district", "austin", "dallas", "public school", "decision"],
    text:
      "Open Data should enrich a human decision with Texas public-school context. It is read-only context, not a source to write back into family or lead records.",
  },
  {
    id: "prd-gt-challenge",
    title: "GT Challenge campaign loop",
    source: "GT Technical Project Brief worked example",
    href: "/help/gt-challenge",
    roles: ["admin", "leader", "operator"],
    tags: ["gt challenge", "quiz", "lead", "campaign", "cpql", "qualified", "consent"],
    text:
      "The GT Challenge should capture consented quiz submissions, assess and bucket each child without a 'not gifted' verdict, roll spend into the budget workstream, and report cost-per-qualified-lead beside other channels.",
  },
  {
    id: "prd-pii",
    title: "PII and minors posture",
    source: "GT submission security posture",
    href: "/help/hot-family",
    roles: ["admin", "leader", "operator"],
    tags: ["pii", "privacy", "child", "minor", "email", "phone", "sms"],
    text:
      "Ask-the-Hub sends and returns de-identified business context only. It must not expose parent emails, phone numbers, child names, raw SMS bodies, or child-level targeting lists.",
  },
];

const GRAPH_FACTS: Citation[] = [
  {
    id: "graph-budget-to-decisions",
    title: "Budget variance routes to Decision Queue",
    source: "Hub knowledge graph",
    href: "/help/budget-variance",
    excerpt: "Budget >10% variance becomes a leadership decision; the budget total remains $365K.",
  },
  {
    id: "graph-crmops-to-banner",
    title: "CRM Ops owns data-confidence",
    source: "Hub knowledge graph",
    href: "/help/data-confidence",
    excerpt: "HubSpot-consuming modules inherit the parity warning; CRM Ops owns field-level repair.",
  },
  {
    id: "graph-opendata-to-decisions",
    title: "Open Data enriches decisions only",
    source: "Hub knowledge graph",
    href: "/api/opendata/decision-enrichment?counties=TRAVIS,DALLAS",
    excerpt: "Texas public-school context can change a recommendation, but it stays read-only decision context.",
  },
];

function getAgent(id: AgentId): AgentDefinition {
  return AGENT_ROSTER.find((agent) => agent.id === id) ?? AGENT_ROSTER[0];
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function retrieveKnowledge(question: string, role: Role, limit = 4): Citation[] {
  const query = new Set(tokens(question));
  const scored = KNOWLEDGE_BASE
    .filter((doc) => doc.roles.includes(role) || doc.roles.includes("operator"))
    .map((doc) => {
      const haystack = [...tokens(doc.title), ...tokens(doc.text), ...doc.tags.flatMap(tokens)];
      const score = haystack.reduce((sum, token) => sum + (query.has(token) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc }) => ({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      href: doc.href,
      excerpt: doc.text,
    }));
  return scored.length ? scored : KNOWLEDGE_BASE.slice(0, 2).map((doc) => ({
    id: doc.id,
    title: doc.title,
    source: doc.source,
    href: doc.href,
    excerpt: doc.text,
  }));
}

function channelSignals(families: Family[]): ChannelSignal[] {
  const bySource = new Map<string, { applicants: number; deposits: number }>();
  for (const family of families) {
    const source = (family.utm_source || family.source || "(not set)").toLowerCase();
    const row = bySource.get(source) ?? { applicants: 0, deposits: 0 };
    if (["applicant", "shadow_day", "deposit"].includes(family.funnel_stage ?? "")) row.applicants += 1;
    if (family.funnel_stage === "deposit") row.deposits += 1;
    bySource.set(source, row);
  }
  return [...bySource.entries()]
    .map(([source, row]) => ({
      source,
      applicants: row.applicants,
      deposits: row.deposits,
      conversionPct: row.applicants ? Number(((100 * row.deposits) / row.applicants).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.deposits - a.deposits || b.conversionPct - a.conversionPct)
    .slice(0, 5);
}

function compactList(items: string[]): string {
  return items.length ? items.join(", ") : "none";
}

function citation(id: string, title: string, source: string, href: string, excerpt: string): Citation {
  return { id, title, source, href, excerpt };
}

function uniqueCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const item of citations) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function classifyAgent(question: string, role: Role): AgentId {
  const q = question.toLowerCase();
  if (includesAny(q, ["trust", "confidence", "parity", "source of truth", "utm", "cac by channel", "reliable"])) {
    return "data-quality-analyst";
  }
  if (includesAny(q, ["open data", "district", "school", "approve", "decision", "budget ask", "austin", "dallas", "field bet"])) {
    return "decision-support-analyst";
  }
  if (role === "operator" || includesAny(q, ["operator", "submit", "my submissions", "how do i", "where do i"])) {
    return "operator-coach";
  }
  return "growth-strategist";
}

function refusalFor(question: string, role: Role): AskHubAnswer["refused"] | undefined {
  const q = question.toLowerCase();
  if (includesAny(q, ["email", "phone", "child name", "sms body", "raw sms", "parent list", "pii"])) {
    return {
      reason: "I cannot expose parent or child-level PII. The agent context is de-identified by design.",
      saferAlternative: "Ask for aggregate segment counts, SLA risk, objection themes, or the owner/action needed next.",
    };
  }
  if (includesAny(q, ["cac by channel", "exact cac", "facebook cac", "meta cac", "channel cac"])) {
    return {
      reason: "CAC by channel is not trustworthy right now because UTM attribution is a known broken area.",
      saferAlternative: "Use Budget CPQL for the GT Challenge and compare channel directionally with the CRM Ops UTM caveat visible.",
    };
  }
  if (role !== "leader" && includesAny(q, ["show the full queue", "all decisions", "full decision queue"])) {
    return {
      reason: "The full Decision Queue is Leadership-only. Operators can submit decisions and track only their own submissions.",
      saferAlternative: "Ask how to raise a decision from your module or check My submissions.",
    };
  }
  return undefined;
}

export async function buildHubSnapshot(opts: BuildSnapshotOptions = {}): Promise<HubSnapshot> {
  const role = opts.role ?? "leader";
  const dataset = opts.dataset ?? generate({ seed: 424242, families: 1200 });
  const scorecard = buildWeeklyScorecard(dataset.families, dataset.budget_workstream);
  const applicants = scorecard.find((row) => row.metric === "Applicants")?.thisWeek ?? 0;
  const deposits = scorecard.find((row) => row.metric === "Deposits")?.thisWeek ?? 0;
  const budget = summarizeBudget(dataset.budget_workstream);
  const decisions = dataset.decisions;
  const viewer = DEMO_USERS.find((user) => user.role === role) ?? DEMO_USERS[0];
  const visibleDecisions = visibleToRole(decisions, {
    role,
    title: opts.userTitle ?? viewer.title,
  });
  const openData =
    opts.enrichment ??
    (await enrichDecisionByCounties(["TRAVIS", "DALLAS"], {
      fetchImpl: async () => {
        throw new Error("Use fixture fallback for deterministic Ask-the-Hub context.");
      },
      now: () => Date.parse("2026-06-26T00:00:00.000Z"),
    }));
  return {
    dataset,
    applicants,
    deposits,
    depositGoal: 180,
    budgetActual: budget.totals.actual,
    budgetPlanned: budget.totals.planned,
    budgetVarianceWorkstreams: budget.autoFlagRows.map((row) => row.name),
    dataConfidence: buildConfidenceBanner(dataset.field_state),
    challenge: summarizeGtChallengeCampaign(dataset.meta_insights, dataset.families),
    decisions,
    visibleDecisions,
    decisionStats: decisionStats(decisions),
    topChannels: channelSignals(dataset.families),
    openData,
    openDataImpact: recommendationImpactFromEnrichment(openData, "pilot"),
  };
}

export function buildDeidentifiedAgentContext(snapshot: HubSnapshot): Record<string, unknown> {
  return {
    applicants: snapshot.applicants,
    deposits: snapshot.deposits,
    depositGoal: snapshot.depositGoal,
    budget: {
      planned: snapshot.budgetPlanned,
      actual: snapshot.budgetActual,
      overPlanWorkstreams: snapshot.budgetVarianceWorkstreams,
    },
    dataConfidence: {
      show: snapshot.dataConfidence.show,
      overallPct: snapshot.dataConfidence.overallPct,
      belowFields: snapshot.dataConfidence.below.map((field) => ({
        field: field.field,
        pct: field.pct,
        expectedUnreliable: field.expectedUnreliable,
      })),
    },
    decisions: {
      visibleCount: snapshot.visibleDecisions.length,
      open: snapshot.decisionStats.open,
      budgetAtStake: snapshot.decisionStats.budgetAtStake,
    },
    challenge: snapshot.challenge,
    openData: {
      counties: snapshot.openData.counties,
      source: snapshot.openData.source,
      recommendation: snapshot.openDataImpact,
    },
    topChannels: snapshot.topChannels,
  };
}

function answerGrowth(snapshot: HubSnapshot): Pick<AskHubAnswer, "answer" | "actions" | "confidence" | "warnings"> {
  const top = snapshot.topChannels[0];
  return {
    confidence: "medium",
    answer:
      `Leadership should focus the next meeting on deposit progress (${snapshot.deposits}/${snapshot.depositGoal}), the over-plan workstream (${compactList(snapshot.budgetVarianceWorkstreams)}), and one measurable GT Challenge experiment. ` +
      `The strongest directional source in the current app-form snapshot is ${top?.source ?? "(not set)"} with ${top?.deposits ?? 0} deposits, but I would not call that a clean CAC-by-channel answer while UTM reliability is flagged. ` +
      `Use the GT Challenge CPQL (${snapshot.challenge.costPerQualifiedLead ? `$${snapshot.challenge.costPerQualifiedLead}` : "not enough qualified volume yet"}) and the Open Data-backed field bet as the business decision, not raw channel CAC.`,
    actions: [
      "Open Dashboard / KPI for shared applicants and deposits before discussing channel performance.",
      "Open Budget before approving any new spend; the budget source of truth must stay at $365K.",
      "Use CRM Ops as the caveat owner before presenting channel CAC.",
    ],
    warnings: ["UTM attribution is known broken, so channel performance should be directional until CRM Ops clears it."],
  };
}

function answerDataQuality(snapshot: HubSnapshot): Pick<AskHubAnswer, "answer" | "actions" | "confidence" | "warnings"> {
  const fields = snapshot.dataConfidence.below.map((field) => `${field.field} (${field.pct}%)`);
  return {
    confidence: "high",
    answer:
      snapshot.dataConfidence.show
        ? `The data-confidence banner should stay visible. Overall parity is ${snapshot.dataConfidence.overallPct}%, with below-threshold fields: ${fields.join(", ")}. App-form fields remain authoritative; HubSpot disagreement is a repair queue item, not a source-of-truth change.`
        : `Data confidence is currently healthy at ${snapshot.dataConfidence.overallPct}%. Keep using canonical module numbers, and continue treating app_form as authoritative for funnel, income, TEFA, and grade.`,
    actions: [
      "Open CRM Ops > Sync parity to inspect field-level drift.",
      "Prioritize unexpected drift before known-unreliable HubSpot fields.",
      "Do not use exact channel CAC until UTM/source issues are cleared.",
    ],
    warnings: ["Known-unreliable fields should be surfaced honestly, not hidden to make the score look green."],
  };
}

function answerDecisionSupport(snapshot: HubSnapshot, role: Role): Pick<AskHubAnswer, "answer" | "actions" | "confidence" | "warnings"> {
  const impact = snapshot.openDataImpact;
  const leaderLine =
    role === "leader"
      ? "You can rule in the Decision Queue after reviewing the cited context."
      : "You can use this to prepare a submission, but only Leadership can view and rule on the full queue.";
  return {
    confidence: impact.confidence,
    answer:
      `For the Austin + Dallas field bet, Open Data moves the recommendation from ${impact.before} to ${impact.after}${impact.changed ? " and changes the recommendation" : ""}. ` +
      `${impact.reason} Current active decision budget at stake is $${snapshot.decisionStats.budgetAtStake.toLocaleString("en-US")}. ${leaderLine}`,
    actions: [
      role === "leader" ? "Open Decision Queue and rule with a note." : "Submit the ask from your module and track it in My submissions.",
      "Keep Open Data as decision context only; do not write district data to family records.",
      "Check Budget before approving any added spend.",
    ],
    warnings: snapshot.openData.source === "live" ? [] : [`Open Data source is ${snapshot.openData.source}; report that caveat in the decision note.`],
  };
}

function answerOperator(snapshot: HubSnapshot): Pick<AskHubAnswer, "answer" | "actions" | "confidence" | "warnings"> {
  return {
    confidence: "high",
    answer:
      `As an Operator, you should work in your owned module, submit decisions from that module when a leadership call is needed, and track only your own submissions. You should not see the full Decision Queue. In this seeded context you can see ${snapshot.visibleDecisions.length} own-status decision row(s), while the full queue remains leader-only.`,
    actions: [
      "Use your module's raise/ask flow when you need budget, approval, or need-info from Leadership.",
      "Open My submissions to track open, decided, or in-flight items you raised.",
      "Escalate data issues to CRM Ops instead of manually reconciling HubSpot fields yourself.",
    ],
    warnings: ["If a link sends you to the full Decision Queue as an Operator, the correct result is a forbidden page."],
  };
}

export async function runAskTheHub(
  request: AskHubRequest,
  opts: BuildSnapshotOptions = {},
): Promise<AskHubAnswer> {
  const question = request.question.trim();
  const role = request.role;
  const snapshot = await buildHubSnapshot({ ...opts, role, userTitle: request.userTitle });
  const refused = refusalFor(question, role);
  const agent = getAgent(refused ? (question.toLowerCase().includes("cac") ? "data-quality-analyst" : classifyAgent(question, role)) : classifyAgent(question, role));
  const retrieved = retrieveKnowledge(question, role);
  const baseCitations = [
    ...retrieved,
    citation(
      "hub-snapshot",
      "Current Hub business snapshot",
      "Deterministic seed + module source-of-truth helpers",
      "/dev/tests",
      `${snapshot.applicants} applicants, ${snapshot.deposits}/${snapshot.depositGoal} deposits, $${snapshot.budgetActual.toLocaleString("en-US")} actual spend against $${snapshot.budgetPlanned.toLocaleString("en-US")} planned.`,
    ),
  ];

  if (refused) {
    return {
      agent,
      mode: process.env.ANTHROPIC_API_KEY && process.env.ASK_THE_HUB_MODEL ? "llm-ready" : "deterministic",
      question,
      answer: `${refused.reason} ${refused.saferAlternative}`,
      confidence: "high",
      citations: uniqueCitations([
        ...baseCitations,
        citation("privacy-posture", "PII/minor data guardrail", "Ask-the-Hub policy", "/help/ask-the-hub", "Agents use de-identified business context and refuse raw PII/minor data."),
      ]),
      actions: [refused.saferAlternative],
      refused,
      warnings: ["Refusal is intentional: it preserves the PRD's honesty and privacy constraints."],
    };
  }

  const body =
    agent.id === "data-quality-analyst"
      ? answerDataQuality(snapshot)
      : agent.id === "decision-support-analyst"
        ? answerDecisionSupport(snapshot, role)
        : agent.id === "operator-coach"
          ? answerOperator(snapshot)
          : answerGrowth(snapshot);

  const extra =
    agent.id === "decision-support-analyst"
      ? [GRAPH_FACTS[0], GRAPH_FACTS[2]]
      : agent.id === "data-quality-analyst"
        ? [GRAPH_FACTS[1]]
        : [GRAPH_FACTS[0], GRAPH_FACTS[1]];

  return {
    agent,
    mode: process.env.ANTHROPIC_API_KEY && process.env.ASK_THE_HUB_MODEL ? "llm-ready" : "deterministic",
    question,
    answer: body.answer,
    confidence: body.confidence,
    citations: uniqueCitations([...baseCitations, ...extra]),
    actions: body.actions,
    warnings: body.warnings,
  };
}

