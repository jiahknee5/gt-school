/**
 * observability.ts — one view over EVERY LLM call-site in the Hub (WS6).
 *
 * The /dev observability surface should show all model-backed locations side by side with
 * the same eval shape (input · node/tool · expected · actual · pass), not just Ask-the-Hub.
 * This module generalizes the AgentEvalRow contract to the Status weekly-verdict generator
 * so both locations render in one table, organized by LLM location.
 */

import type { SeedDataset } from "@/lib/seed/types";
import type { ProgramScope } from "@/lib/program-scope";
import type { AgentEvalRow } from "./agents";
import { buildStatusBoard } from "@/lib/status/board";
import { generateDeterministic } from "@/lib/status/generate";
import { ANSWER_SECTION_LABELS, checkAnswerConformance, type AnswerSectionKey } from "@/lib/status/rubrics";

export interface LlmCallSite {
  /** Where the model is called (file/feature). */
  location: string;
  provider: "deterministic" | "anthropic";
  model: string;
  description: string;
  evalRows: AgentEvalRow[];
}

/**
 * The Status weekly-verdict generator as an eval'd LLM call-site: one row for the verdict
 * headline, one per Answer section (Where/Working/Attention/Do), and one rubric-conformance
 * row — the same falsifiable contract the Ask-the-Hub graph nodes use.
 */
export function statusGenCallSite(ds: SeedDataset, program: ProgramScope = "fall_enrollment"): LlmCallSite {
  const board = buildStatusBoard(ds, program);
  const content = generateDeterministic(board);
  const conf = checkAnswerConformance({
    headline: content.headline,
    rag: content.rag,
    sections: content.answerSections.map((s) => ({ key: s.key as AnswerSectionKey, bullets: s.bullets })),
  });

  const rows: AgentEvalRow[] = [
    {
      node: "status-writer · verdict",
      input: `program=${program}, week=${board.weekOf}, deposits=${board.northStar.current}/${board.northStar.target}`,
      expectedOutput: "One-line verdict headline (≥4 words), honest about the miss.",
      actualOutput: content.headline,
      pass: content.headline.trim().split(/\s+/).length >= 4,
      citations: [],
    },
    ...content.answerSections.map((s) => ({
      node: `status-writer · ${s.key}`,
      input: `${ANSWER_SECTION_LABELS[s.key as AnswerSectionKey]} section`,
      expectedOutput: "Non-empty, grounded bullet(s).",
      actualOutput: s.bullets[0]?.text ?? "(empty)",
      pass: s.bullets.length > 0,
      citations: [],
    })),
    {
      node: "status-writer · rubric",
      input: "Where/Working/Attention/Do conformance",
      expectedOutput: "Passes checkAnswerConformance (sections present, numbers cited, ties to the Aug-17 clock).",
      actualOutput: conf.pass ? "conformant" : conf.failures.join("; "),
      pass: conf.pass,
      citations: [],
    },
  ];

  return {
    location: "Status generation · lib/status/generate.ts",
    provider: "deterministic",
    model: "deterministic-rubric-v1",
    description:
      "Weekly executive verdict — deterministic rubric (LLM-optional), recallable + persisted as a status snapshot; refreshed by the Monday cron.",
    evalRows: rows,
  };
}
