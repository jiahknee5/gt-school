// WS5 — data-sync verification vs PRD. Pins the cross-cutting sync contract so it can't
// silently regress: every instrumented KPI source has connector freshness; stale is
// detected; sync parity is computed and trips the data-confidence banner below threshold;
// every governed field declares a single source-of-truth; and no surface can read past today.

import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { KPI_DEFINITIONS, availableWeeks, currentWeekIndex, weekMondays } from "@/lib/metrics/registry";
import { connectorFreshness, freshnessFor } from "@/lib/dashboard/freshness";
import { computeSeedParity, seedBannerState } from "@/lib/crm-ops/parity-view";
import { parityThreshold } from "@/lib/parity";
import { SYNCED_FIELDS } from "@/lib/seed/dictionaries";

const ds = generate({ seed: 424242, families: 1200 });
const fresh = connectorFreshness(ds);

describe("freshness SLA — every instrumented KPI source has a connector with an age + status", () => {
  it("instrumented KPIs resolve to a freshness entry", () => {
    for (const def of KPI_DEFINITIONS.filter((d) => d.instrumented)) {
      const f = freshnessFor(def.source, fresh);
      expect(f, `no freshness for instrumented source "${def.source}" (${def.key})`).toBeDefined();
      expect(typeof f!.ageMinutes).toBe("number");
      expect(["fresh", "stale", "error"]).toContain(f!.status);
    }
  });

  it("the seeded stale connector is detected (stale-but-green risk is provable)", () => {
    expect(fresh.some((f) => f.status === "stale")).toBe(true);
  });
});

describe("sync parity + source-of-truth", () => {
  it("parity is computed from field_state and trips the banner below threshold", () => {
    const parity = computeSeedParity(ds.field_state);
    expect(parity.overallPct).toBeGreaterThan(0);
    expect(parity.overallPct).toBeLessThanOrEqual(100);
    // A threshold deliberately above the current parity must surface at least one below-field.
    const strict = seedBannerState(ds.field_state, Math.min(100, parity.overallPct + 5));
    expect(strict.below.length).toBeGreaterThan(0);
  });

  it("parityThreshold is a sane fraction (0..1)", () => {
    const t = parityThreshold();
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it("every governed field declares its source-of-truth (app_form | hubspot | none)", () => {
    for (const f of SYNCED_FIELDS) {
      expect(["app_form", "hubspot", "none"], `bad authority for ${f.field}`).toContain(f.authority);
    }
    // A field flagged unreliable must still name a real owning source — you can't both be
    // governed-but-drifting AND ungoverned. (Ungoverned "none" fields are simply not synced.)
    for (const f of SYNCED_FIELDS.filter((f) => f.unreliable)) {
      expect(["app_form", "hubspot"], `unreliable field ${f.field} needs a real SoT`).toContain(f.authority);
    }
    // The known data-quality story: source/tefa_status/income_band are flagged unreliable.
    const unreliable = new Set(SYNCED_FIELDS.filter((f) => f.unreliable).map((f) => f.field));
    expect(unreliable.has("source")).toBe(true);
  });
});

describe("as-of-week — no surface can read past today", () => {
  it("availableWeeks never extends beyond the current week", () => {
    const now = Date.parse("2026-06-27T12:00:00.000Z");
    const weeks = availableWeeks(now);
    const all = weekMondays();
    expect(weeks.length).toBe(currentWeekIndex(now) + 1);
    expect(weeks[weeks.length - 1]).toBe(all[currentWeekIndex(now)]);
    // every future planned week is excluded
    for (const w of all.slice(currentWeekIndex(now) + 1)) {
      expect(weeks).not.toContain(w);
    }
  });

  it("no family is dated after the dataset's own as-of clock", () => {
    // With an explicit asOf the seed must not emit a created_at beyond that clock.
    const asOf = "2026-06-22T00:00:00.000Z";
    const capped = generate({ seed: 424242, families: 300, asOf });
    const cutoff = Date.parse(asOf);
    for (const f of capped.families) {
      expect(Date.parse(f.created_at) <= cutoff).toBe(true);
    }
  });
});
