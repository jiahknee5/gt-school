import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { buildStatusBoard } from "@/lib/status/board";
import { checkStageContract } from "@/lib/status/rubrics";
import { STAGE_ROW_SPECS } from "@/lib/status/rowspec";
import { defaultReportingWeek } from "@/lib/metrics/registry";

const ds = generate({ seed: 424242, families: 1200 });
const board = buildStatusBoard(ds, "fall_enrollment", defaultReportingWeek());

describe("Status per-row accountability contract", () => {
  it("every funnel stage has an owner + role and passes the contract", () => {
    for (const stage of board.stages) {
      const result = checkStageContract(stage);
      expect(result.failures).toEqual([]);
      expect(result.pass).toBe(true);
      expect(stage.owner).toBeTruthy();
      expect(stage.ownerRole).toBeTruthy();
    }
  });

  it("each stage exposes exactly one exec metric with a real this-week value", () => {
    for (const stage of board.stages) {
      const exec = (stage.metrics ?? []).filter((m) => m.surface === "exec");
      expect(exec).toHaveLength(1);
      expect(typeof exec[0].thisWeek).toBe("number");
      expect(exec[0].value).toMatch(/\d/);
    }
  });

  it("registry-backed metrics carry week-over-week (delta/trend); derived ones are honestly null", () => {
    const allMetrics = board.stages.flatMap((s) => s.metrics ?? []);
    const deposits = allMetrics.find((m) => m.key === "deposits");
    expect(deposits).toBeDefined();
    expect(deposits!.trend.length).toBeGreaterThan(0);
    const sla = allMetrics.find((m) => m.key === "sla_24h");
    expect(sla).toBeDefined();
    expect(sla!.derived).toBe(true);
    expect(sla!.delta).toBeNull();
  });

  it("the metric contract is the same shape every week (consistent across weeks)", () => {
    const w3 = buildStatusBoard(ds, "fall_enrollment", "2026-06-22");
    const w8 = buildStatusBoard(ds, "fall_enrollment", "2026-07-27");
    for (let i = 0; i < w3.stages.length; i++) {
      const a = w3.stages[i].metrics ?? [];
      const b = w8.stages[i].metrics ?? [];
      expect(a.map((m) => m.key)).toEqual(b.map((m) => m.key));
      expect(a.map((m) => m.surface)).toEqual(b.map((m) => m.surface));
    }
  });

  it("the fixed metric set is rendered into each stage drawer", () => {
    for (const stage of board.stages) {
      expect(stage.drawerSections.some((s) => s.heading === "Weekly metric contract")).toBe(true);
    }
  });

  it("every owner maps to a real team role so the exec sees the whole funnel", () => {
    const owners = new Set(STAGE_ROW_SPECS.map((s) => s.owner));
    expect(owners.size).toBeGreaterThanOrEqual(4);
    for (const spec of STAGE_ROW_SPECS) {
      expect(spec.metrics.filter((m) => m.surface === "exec")).toHaveLength(1);
    }
  });
});
