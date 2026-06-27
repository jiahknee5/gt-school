import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { buildStatusBoard } from "@/lib/status/board";
import {
  availableWeeks,
  currentWeekIndex,
  kpiCumulative,
  kpiWeeklySeries,
  weekMondays,
} from "@/lib/metrics/registry";

const ds = generate({ seed: 424242, families: 1200 });
const WEEKS = weekMondays();

// A pinned "today" so the test is stable regardless of the wall clock: 2026-06-27 is
// week 3 of the 2026-06-01 sprint (the demo's current date).
const PINNED_NOW = Date.parse("2026-06-27T12:00:00.000Z");

describe("as-of clock — no future weeks are reachable", () => {
  it("availableWeeks stops at the current week", () => {
    const idx = currentWeekIndex(PINNED_NOW);
    const weeks = availableWeeks(PINNED_NOW);
    expect(idx).toBe(3);
    expect(weeks).toHaveLength(idx + 1);
    expect(weeks).toEqual(WEEKS.slice(0, idx + 1));
  });

  it("availableWeeks never exposes a week beyond today", () => {
    const weeks = availableWeeks(PINNED_NOW);
    const currentMonday = WEEKS[currentWeekIndex(PINNED_NOW)];
    for (const w of weeks) {
      expect(w <= currentMonday).toBe(true);
    }
    expect(weeks).not.toContain(WEEKS[WEEKS.length - 1]);
  });
});

describe("as-of-week cumulative — never the end-of-sprint total", () => {
  it("kpiCumulative(deposits) equals the running sum through the selected week", () => {
    const series = kpiWeeklySeries("deposits", ds);
    for (let idx = 0; idx < WEEKS.length; idx++) {
      const expected = series.slice(0, idx + 1).reduce((a, v) => a + v, 0);
      expect(kpiCumulative("deposits", ds, WEEKS[idx])).toBe(expected);
    }
  });

  it("an early week is strictly less than the full-sprint deposit total", () => {
    const earlyWeek = WEEKS[3];
    const fullTotal = kpiWeeklySeries("deposits", ds).reduce((a, v) => a + v, 0);
    expect(kpiCumulative("deposits", ds, earlyWeek)).toBeLessThan(fullTotal);
    expect(kpiCumulative("deposits", ds, WEEKS[WEEKS.length - 1])).toBe(fullTotal);
  });
});

describe("Status board North Star is as-of-week (monotonic, not end-of-sprint)", () => {
  it("deposits at an early week are less than at a later week", () => {
    const early = buildStatusBoard(ds, "fall_enrollment", WEEKS[3]);
    const later = buildStatusBoard(ds, "fall_enrollment", WEEKS[10]);
    expect(early.northStar.current).toBeLessThan(later.northStar.current);
  });

  it("the early-week North Star is not the whole-dataset deposit count", () => {
    const board = buildStatusBoard(ds, "fall_enrollment", WEEKS[3]);
    const endOfSprint = kpiWeeklySeries("deposits", ds).reduce((a, v) => a + v, 0);
    expect(board.northStar.current).toBeLessThan(endOfSprint);
  });
});
