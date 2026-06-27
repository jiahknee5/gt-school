/**
 * generate.ts — fills the Status board's verdict (the Answer + per-stage narrative)
 * per the rubrics in lib/status/rubrics.ts, grounded in the REAL board numbers.
 *
 * Two interchangeable generators behind one interface:
 *   1. DETERMINISTIC (always available) — slots the real numbers into the rubric
 *      structure. No API key required; this is what the demo runs on.
 *   2. LLM (optional) — an Anthropic-backed step that rewrites the deterministic
 *      draft to the rubric, validated + PII/limits-guarded, with the deterministic
 *      draft as a hard fallback. Never hard-depends on a live key (litellm BANNED —
 *      direct fetch only).
 *
 * Every run is labeled source=llm|deterministic so the board can show provenance.
 */

import type { ProgramScope } from "@/lib/program-scope";
import type {
  StatusBoard,
  StatusBullet,
  RagStatus,
  AnswerSection,
} from "./board";
import {
  ANSWER_RUBRIC,
  ANSWER_SECTION_LABELS,
  COLUMN_RUBRICS,
  STAGE_CELL_RUBRICS,
  checkAnswerConformance,
  type AnswerSectionKey,
  type AnswerShape,
} from "./rubrics";

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface GeneratedStageNarrative {
  stageKey: string;
  name: string;
  rag: RagStatus;
  headline: string;
  bullets: StatusBullet[];
  /** The "why" behind the verdict — shown in the drawer. */
  reasoning: string[];
}

export interface StatusSnapshotContent {
  headline: string;
  rag: RagStatus;
  /** Rubric-structured Answer (where / on_track / why / do). */
  answerSections: AnswerSection[];
  /** Flattened lead bullets for the calm default hero. */
  answerBullets: StatusBullet[];
  stages: GeneratedStageNarrative[];
  northStarLine: string;
}

export interface StatusSnapshot {
  program: ProgramScope;
  weekStart: string;
  generatedAt: string;
  source: "llm" | "deterministic";
  model: string;
  /** Hash of the grounding inputs — lets us detect stale snapshots vs current data. */
  inputsHash: string;
  content: StatusSnapshotContent;
}

// ---------------------------------------------------------------------------
// Provider interface (pluggable; deterministic fallback always wins on failure)
// ---------------------------------------------------------------------------

export interface StatusGenInput {
  program: ProgramScope;
  weekStart: string;
  facts: Record<string, unknown>;
  deterministicDraft: StatusSnapshotContent;
  rubricSummary: string;
}

export interface StatusGenProvider {
  name: "anthropic" | "fake";
  model: string;
  generate(input: StatusGenInput): Promise<StatusSnapshotContent>;
}

export interface GenerateOptions {
  /** Test/dev escape hatch. `null` forces deterministic even when a key is set. */
  provider?: StatusGenProvider | null;
  now?: () => number;
}

// ---------------------------------------------------------------------------
// Grounding inputs + hash
// ---------------------------------------------------------------------------

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildSnapshotInputs(board: StatusBoard): { facts: Record<string, unknown>; inputsHash: string } {
  const ns = board.northStar;
  const facts: Record<string, unknown> = {
    program: board.programScope,
    weekOf: board.weekOf,
    daysToCutoff: board.daysToCutoff,
    deposits: ns.current,
    depositTarget: ns.target,
    paceMarker: ns.pace,
    gapToPace: ns.gap,
    weeklyActual: ns.weeklyActual,
    weeklyRequired: ns.weeklyRequired,
    projection: ns.projection,
    pctOfTarget: ns.pctOfTarget,
    rag: board.answer.rag,
    openDecisions: board.openDecisionCount,
    stages: board.stages.map((s) => ({ key: s.key, rag: s.rag, headline: s.narrative.bullets?.[0]?.text ?? "" })),
  };
  return { facts, inputsHash: fnv1a(JSON.stringify(facts)) };
}

// ---------------------------------------------------------------------------
// Deterministic generator — the rubric made real with the board's numbers
// ---------------------------------------------------------------------------

function findBullet(bullets: StatusBullet[], re: RegExp): StatusBullet | undefined {
  return bullets.find((b) => re.test(b.text));
}

function section(key: AnswerSectionKey, bullets: StatusBullet[]): AnswerSection {
  return { key, label: ANSWER_SECTION_LABELS[key], bullets };
}

export function generateDeterministic(board: StatusBoard): StatusSnapshotContent {
  const ns = board.northStar;
  const ab = board.answer.bullets;
  const onTrack = ns.gap >= 0 && board.answer.rag !== "red";

  const depositsBullet: StatusBullet = {
    text: `${ns.current}/${ns.target} deposits — ${ns.pctOfTarget}% of the Fall goal, ${ns.gap >= 0 ? "+" : ""}${ns.gap} versus linear pace.`,
    emphasis: [`${ns.current}/${ns.target}`, `${ns.gap >= 0 ? "+" : ""}${ns.gap}`],
    tone: ns.gap < 0 ? "bad" : "neutral",
  };
  const demandBullet =
    findBullet(ab, /applicant|demand/i) ?? {
      text: "Demand is healthy — applicants are not the constraint.",
      tone: "neutral" as const,
    };
  const paceBullet: StatusBullet = {
    text: `Closing ${ns.weeklyActual}/wk against the ${ns.weeklyRequired}/wk needed${
      ns.projection < ns.target ? ` — projecting ${ns.projection} of ${ns.target} on the current run rate` : ""
    }.`,
    emphasis: [`${ns.weeklyActual}/wk`, `${ns.weeklyRequired}/wk`],
    tone: ns.weeklyActual < ns.weeklyRequired ? "bad" : "neutral",
  };
  const bindingBullet = findBullet(ab, /bind|conversion/i) ?? ab[0];
  const slaBullet =
    findBullet(ab, /sla|speed-to-lead|late/i) ?? {
      text: "Speed-to-lead is holding — keep defending the 24h SLA.",
      tone: "neutral" as const,
    };
  const actionBullet =
    findBullet(ab, /do this|fix|assign|before aug/i) ?? {
      text: `Fix the offer→deposit step before Aug 17 (${board.daysToCutoff} days left).`,
      tone: "neutral" as const,
    };
  const decisionsBullet =
    findBullet(ab, /decision/i) ?? {
      text: `${board.openDecisionCount} decision${board.openDecisionCount === 1 ? "" : "s"} await leadership.`,
      tone: "neutral" as const,
    };

  // "What's working" — the strengths to protect: healthy demand + any GREEN funnel stage's
  // headline + a pace-positive note when we're ahead. Honestly the shortest beat early-sprint
  // (when most stages are red), but never empty — demand stands in.
  const greenStrengths = board.stages
    .filter((s) => s.rag === "green")
    .map((s) => s.narrative.bullets?.[0])
    .filter((b): b is StatusBullet => Boolean(b && b.text));
  const workingBullets: StatusBullet[] = [{ ...demandBullet, tone: "good" }];
  for (const b of greenStrengths.slice(0, 2)) workingBullets.push({ ...b, tone: "good" });
  if (ns.gap >= 0) {
    workingBullets.push({
      text: `Ahead of linear pace — ${ns.current}/${ns.target} deposits, +${ns.gap} vs the marker.`,
      emphasis: [`+${ns.gap}`],
      tone: "good",
    });
  }

  // The Answer is a natural exec talk-through: where we stand → what's working →
  // what needs attention → what to do.
  const answerSections: AnswerSection[] = [
    section("where", [depositsBullet, paceBullet]),
    section("working", workingBullets.slice(0, 3)),
    section("attention", [bindingBullet, slaBullet]),
    section("do", [actionBullet, decisionsBullet]),
  ];

  // Lead bullets for the calm default hero: where we stand, then the action.
  const answerBullets: StatusBullet[] = [bindingBullet, actionBullet, demandBullet, slaBullet, decisionsBullet];

  const stages: GeneratedStageNarrative[] = board.stages.map((s) => {
    const reasoning: string[] = [];
    if (s.owner) {
      reasoning.push(`Owner: ${s.owner}${s.ownerRole ? ` (${s.ownerRole})` : ""}.`);
    }
    if (s.position.stat) {
      reasoning.push(
        `Position: ${s.position.stat.value}${s.position.stat.unit ? ` ${s.position.stat.unit}` : ""}${
          s.position.stat.delta ? ` (${s.position.stat.delta})` : ""
        }.`,
      );
    }
    // Cite the stage's fixed weekly metric contract (this week + WoW where we have history).
    for (const m of s.metrics ?? []) {
      const wow = m.delta != null ? ` (Δ ${m.delta >= 0 ? "+" : ""}${m.delta} WoW)` : "";
      reasoning.push(`${m.surface === "exec" ? "Headline metric" : "Metric"} — ${m.label}: ${m.value}${wow}.`);
    }
    const driverGlance = s.drivers.subline ?? s.drivers.owner;
    if (driverGlance) reasoning.push(`Driver: ${driverGlance}.`);
    if (s.drivers.derivedNote) reasoning.push(s.drivers.derivedNote);
    if (s.decisions.decision) reasoning.push(`Decision: ${s.decisions.decision.question}`);
    else if (s.decisions.thinReason) reasoning.push(`No open decision — ${s.decisions.thinReason}`);
    return {
      stageKey: s.key,
      name: s.name,
      rag: s.rag,
      headline: s.narrative.bullets?.[0]?.text ?? "",
      bullets: s.narrative.bullets ?? [],
      reasoning,
    };
  });

  return {
    headline: board.answer.headline,
    rag: board.answer.rag,
    answerSections,
    answerBullets,
    stages,
    northStarLine: `${ns.label}: ${ns.current}/${ns.target} (${ns.pctOfTarget}%), ${ns.gap >= 0 ? "+" : ""}${ns.gap} vs pace, ${
      onTrack ? "on/ahead of pace" : "behind pace"
    }.`,
  };
}

// ---------------------------------------------------------------------------
// LLM provider (optional). Direct fetch — litellm is BANNED.
// ---------------------------------------------------------------------------

function rubricSummary(): string {
  const cols = Object.values(COLUMN_RUBRICS)
    .map((r) => `- ${r.column}: ${r.question} (${r.qualityBar})`)
    .join("\n");
  const stageRules = STAGE_CELL_RUBRICS.map((r) => `- ${r.id}: ${r.question}`).join("\n");
  const answer = `Answer must resolve, as organized bullets: ${ANSWER_RUBRIC.sectionsRequired
    .map((k) => ANSWER_SECTION_LABELS[k])
    .join(" / ")}. ${ANSWER_RUBRIC.qualityBar}`;
  return [`ANSWER RUBRIC: ${answer}`, "COLUMN RUBRICS:", cols, "STAGE RULES:", stageRules].join("\n");
}

function statusProviderEnabled(opts: GenerateOptions): boolean {
  if (opts.provider === null) return false;
  if (opts.provider) return true;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  if (process.env.STATUS_GEN_LIVE === "false") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY && (process.env.STATUS_GEN_MODEL || process.env.ASK_THE_HUB_MODEL));
}

export class AnthropicStatusProvider implements StatusGenProvider {
  name = "anthropic" as const;
  model: string;
  private apiKey: string;

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = opts.model ?? process.env.STATUS_GEN_MODEL ?? process.env.ASK_THE_HUB_MODEL ?? "";
  }

  async generate(input: StatusGenInput): Promise<StatusSnapshotContent> {
    if (!this.apiKey || !this.model) throw new Error("Anthropic status provider is not configured.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1600,
          system: [
            "You are the GT Marketing Hub executive status writer.",
            "Rewrite the deterministic draft to the rubric in board-appropriate, C-suite language.",
            "Use ONLY the numbers in the provided facts/draft — never invent figures.",
            "Keep narrative bullets to ~25 words (L5). Lead with the so-what. Be honest about misses.",
            "Return ONLY JSON matching the draft's shape (same keys).",
          ].join("\n"),
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                program: input.program,
                weekStart: input.weekStart,
                rubric: input.rubricSummary,
                facts: input.facts,
                draft: input.deterministicDraft,
              }),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic status provider failed HTTP ${res.status}.`);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const rawText = data.content?.map((p) => (p.type === "text" ? p.text ?? "" : "")).join("\n").trim() ?? "";
      const start = rawText.indexOf("{");
      const end = rawText.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("Status provider returned no JSON.");
      const parsed = JSON.parse(rawText.slice(start, end + 1)) as Partial<StatusSnapshotContent>;
      return mergeWithDraft(parsed, input.deterministicDraft);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Trust the draft's structure; accept only well-formed LLM overrides (kept grounded). */
function mergeWithDraft(parsed: Partial<StatusSnapshotContent>, draft: StatusSnapshotContent): StatusSnapshotContent {
  const headline = typeof parsed.headline === "string" && parsed.headline.trim() ? parsed.headline.trim() : draft.headline;
  const answerSections =
    Array.isArray(parsed.answerSections) && parsed.answerSections.length === draft.answerSections.length
      ? draft.answerSections.map((d, i) => {
          const p = parsed.answerSections![i];
          const bullets = Array.isArray(p?.bullets) && p.bullets.length
            ? p.bullets
                .filter((b): b is StatusBullet => Boolean(b && typeof b.text === "string" && b.text.trim()))
                .slice(0, 3)
            : d.bullets;
          return { key: d.key, label: d.label, bullets };
        })
      : draft.answerSections;
  const stages =
    Array.isArray(parsed.stages) && parsed.stages.length === draft.stages.length
      ? draft.stages.map((d, i) => {
          const p = parsed.stages![i];
          const bullets = Array.isArray(p?.bullets) && p.bullets.length
            ? p.bullets.filter((b): b is StatusBullet => Boolean(b && typeof b.text === "string")).slice(0, 3)
            : d.bullets;
          return {
            ...d,
            headline: typeof p?.headline === "string" && p.headline.trim() ? p.headline.trim() : d.headline,
            bullets,
            reasoning: Array.isArray(p?.reasoning) && p.reasoning.length
              ? p.reasoning.filter((r): r is string => typeof r === "string").slice(0, 6)
              : d.reasoning,
          };
        })
      : draft.stages;
  return {
    headline,
    rag: draft.rag,
    answerSections,
    answerBullets: draft.answerBullets,
    stages,
    northStarLine: typeof parsed.northStarLine === "string" && parsed.northStarLine.trim() ? parsed.northStarLine.trim() : draft.northStarLine,
  };
}

function asAnswerShape(content: StatusSnapshotContent): AnswerShape {
  return {
    headline: content.headline,
    rag: content.rag,
    sections: content.answerSections.map((s) => ({ key: s.key as AnswerSectionKey, bullets: s.bullets })),
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function generateStatusSnapshot(
  board: StatusBoard,
  program: ProgramScope,
  opts: GenerateOptions = {},
): Promise<StatusSnapshot> {
  const now = opts.now ?? Date.now;
  const deterministic = generateDeterministic(board);
  const { facts, inputsHash } = buildSnapshotInputs(board);

  let content = deterministic;
  let source: StatusSnapshot["source"] = "deterministic";
  let model = "deterministic-rubric-v1";

  if (statusProviderEnabled(opts)) {
    const provider = opts.provider ?? new AnthropicStatusProvider();
    try {
      const llm = await provider.generate({
        program,
        weekStart: board.weekOf,
        facts,
        deterministicDraft: deterministic,
        rubricSummary: rubricSummary(),
      });
      // The LLM output must still pass the Answer rubric, else we keep deterministic.
      if (checkAnswerConformance(asAnswerShape(llm)).pass) {
        content = llm;
        source = "llm";
        model = provider.model || "configured-provider";
      }
    } catch {
      // Deterministic draft stands — the feature works with no key / on provider error.
    }
  }

  return {
    program,
    weekStart: board.weekOf,
    generatedAt: new Date(now()).toISOString(),
    source,
    model,
    inputsHash,
    content,
  };
}

// ---------------------------------------------------------------------------
// Overlay: apply a snapshot's verdict onto a freshly-built numeric board
// ---------------------------------------------------------------------------

export function applySnapshotToBoard(
  board: StatusBoard,
  snapshot: StatusSnapshot,
  flags: { recalled: boolean; isCurrent: boolean },
): StatusBoard {
  board.answer.headline = snapshot.content.headline;
  board.answer.rag = snapshot.content.rag;
  board.answer.bullets = snapshot.content.answerBullets;
  board.answer.sections = snapshot.content.answerSections;

  for (const gen of snapshot.content.stages) {
    const stage = board.stages.find((s) => s.key === gen.stageKey);
    if (!stage) continue;
    if (gen.bullets.length) stage.narrative.bullets = gen.bullets;
    if (gen.reasoning.length) {
      stage.drawerSections.push({ heading: "Generated reasoning", lines: gen.reasoning });
    }
  }

  board.snapshotMeta = {
    source: snapshot.source,
    model: snapshot.model,
    generatedAt: snapshot.generatedAt,
    weekStart: snapshot.weekStart,
    recalled: flags.recalled,
    isCurrent: flags.isCurrent,
  };
  return board;
}
