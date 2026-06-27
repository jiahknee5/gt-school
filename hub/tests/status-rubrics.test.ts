import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { buildStatusBoard, type SpineColumn } from "@/lib/status/board";
import {
  ANSWER_RUBRIC,
  allCellRubrics,
  cellRubricFor,
  checkAnswerConformance,
  checkCellConformance,
  type AnswerSectionKey,
} from "@/lib/status/rubrics";
import { generateDeterministic } from "@/lib/status/generate";

const ds = generate({ seed: 424242, families: 1200 });
const COLUMNS: SpineColumn[] = ["position", "drivers", "decisions", "narrative"];

describe("Status per-cell rubric conformance", () => {
  it("every stage cell satisfies its column rubric", () => {
    const board = buildStatusBoard(ds);
    for (const stage of board.stages) {
      for (const col of COLUMNS) {
        const res = checkCellConformance(
          stage[col],
          col,
          stage.key,
          col === "position" ? stage.rag : undefined,
        );
        expect(res.failures, `${stage.name} · ${col}`).toEqual([]);
      }
    }
  });

  it("specialized stage rubrics resolve; base rubric is the fallback", () => {
    expect(cellRubricFor("position", "conversion").id).toBe("position.conversion");
    expect(cellRubricFor("narrative", "conversion").id).toBe("narrative.conversion");
    expect(cellRubricFor("position", "nurture").id).toBe("position.nurture");
    expect(cellRubricFor("drivers", "awareness").id).toBe("drivers");
    expect(allCellRubrics().length).toBeGreaterThanOrEqual(4);
  });

  it("Position cells show where / vs-last-week / vs-goal on KPI-backed stages", () => {
    const board = buildStatusBoard(ds);
    // Stages anchored to a real scorecard KPI (target + weekly series) must carry
    // BOTH a WoW chip and a vs-goal marker — the user's where/last-week/goal ask.
    for (const key of ["awareness", "acquisition", "conversion", "advocacy"] as const) {
      const stage = board.stages.find((s) => s.key === key)!;
      expect(stage.position.stat?.value, `${key} headline`).toBeTruthy();
      expect(stage.position.stat?.wow, `${key} WoW`).toBeTruthy();
      expect(stage.position.stat?.goal, `${key} goal`).toBeTruthy();
    }
  });

  it("Position cells omit the goal honestly when no target exists (no fabrication)", () => {
    const board = buildStatusBoard(ds);
    // Derived stand-ins (no weekly series / no target) must NOT invent a goal —
    // they carry an honest basis note (or derivation caveat) instead.
    for (const key of ["activation", "nurture"] as const) {
      const stage = board.stages.find((s) => s.key === key)!;
      expect(stage.position.stat?.goal, `${key} should have no fabricated goal`).toBeFalsy();
      expect(
        Boolean(stage.position.stat?.basisNote || stage.position.derivedNote),
        `${key} honest basis note`,
      ).toBe(true);
    }
  });

  it("the Position rubric fails a cell that hides last-week and goal with no honest note", () => {
    const broken = {
      owner: "x",
      stat: { value: "42", unit: "things" },
    };
    const res = checkCellConformance(broken, "position", "awareness", "green");
    expect(res.pass).toBe(false);
    expect(res.failures.join(" ")).toMatch(/vs-last-week/);
    expect(res.failures.join(" ")).toMatch(/vs-goal/);
  });

  it("the conversion narrative is held to naming the binding constraint", () => {
    const board = buildStatusBoard(ds);
    const conv = board.stages.find((s) => s.key === "conversion")!;
    // Break it: a narrative with no binding language must fail the specialized rubric.
    const broken = { ...conv.narrative, bullets: [{ text: "Deposits moved up a bit this week 5." }] };
    const res = checkCellConformance(broken, "narrative", "conversion");
    expect(res.pass).toBe(false);
  });
});

describe("Overall-status (The Answer) rubric", () => {
  it("requires the four C-suite sections in order", () => {
    expect(ANSWER_RUBRIC.sectionsRequired).toEqual(["where", "working", "attention", "do"]);
  });

  it("deterministic generation produces a conformant Answer", () => {
    const board = buildStatusBoard(ds);
    const content = generateDeterministic(board);
    const res = checkAnswerConformance({
      headline: content.headline,
      rag: content.rag,
      sections: content.answerSections.map((s) => ({ key: s.key as AnswerSectionKey, bullets: s.bullets })),
    });
    expect(res.failures).toEqual([]);
    expect(content.answerSections.map((s) => s.key)).toEqual(["where", "working", "attention", "do"]);
  });

  it("flags an Answer missing a section", () => {
    const res = checkAnswerConformance({
      headline: "On track for Fall deposits this week",
      rag: "green",
      sections: [{ key: "where", bullets: [{ text: "120 of 180 deposits, pace ok by Aug 17" }] }],
    });
    expect(res.pass).toBe(false);
  });
});
