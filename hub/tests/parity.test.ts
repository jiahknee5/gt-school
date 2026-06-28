import { afterAll, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../scripts/_env";

loadEnvLocal();

import { closeDb, withoutProgram } from "../lib/db";
import {
  computeParity,
  getBannerState,
  normalizeValue,
  parityThreshold,
  runParityCheck,
} from "../lib/parity";

const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const T = 20000;

// Honest skip when no live DB (shows SKIPPED, not passed-empty).
(HAS_DB ? describe : describe.skip)("parity engine (live seeded Supabase)", () => {
  afterAll(async () => {
    if (HAS_DB) await closeDb();
  });

  it("normalizeValue folds case/whitespace and empties to null", () => {
    expect(normalizeValue("  Organic ")).toBe("organic");
    expect(normalizeValue("ESA  Planned")).toBe("esa planned");
    expect(normalizeValue("")).toBeNull();
    expect(normalizeValue("   ")).toBeNull();
    expect(normalizeValue(null)).toBeNull();
    expect(normalizeValue("65-160K")).toBe("65-160k"); // sentinel preserved (not collapsed)
  });

  it("rolls up parity over governed fields: overall healthy, income below threshold; writes a snapshot", async () => {
    if (!HAS_DB) {
      console.log("SKIP: APP_RW_DATABASE_URL not set");
      expect(HAS_DB).toBe(false);
      return;
    }

    const before = await withoutProgram(
      (sql) => sql<{ c: number }[]>`select count(*)::int as c from parity_snapshot`,
    );

    const result = await runParityCheck();

    // Live HubSpot sync can move the exact income percentage. The contract is
    // that overall parity stays healthy while income is visibly below threshold.
    console.log(
      `parity: overall=${result.overallPct}% record=${result.recordPct}% rows=${result.inParityRows}/${result.totalRows} flipped=${result.flipped}`,
    );
    const income = result.fieldDetail.find((f) => f.field === "income_band");
    console.log(`income_band: ${income?.inParity}/${income?.total} = ${income?.pct}%`);

    expect(result.overallPct).toBeGreaterThanOrEqual(97);
    expect(result.overallPct).toBeLessThanOrEqual(99);
    expect(income).toBeTruthy();
    expect(income!.pct).toBeGreaterThanOrEqual(60);
    expect(income!.pct).toBeLessThan(parityThreshold() * 100);
    expect(income!.expectedUnreliable).toBe(true);

    // segmentation fields (no field_authority row) are OUT of parity scope.
    expect(result.fieldDetail.find((f) => f.field === "geo")).toBeUndefined();
    expect(result.fieldDetail.find((f) => f.field === "persona")).toBeUndefined();

    // a fresh snapshot row was written.
    const after = await withoutProgram(
      (sql) => sql<{ c: number }[]>`select count(*)::int as c from parity_snapshot`,
    );
    expect(after[0].c).toBeGreaterThanOrEqual(before[0].c + 1);

    // recompute is deterministic (read-only computeParity matches the persisted run).
    const again = await withoutProgram((sql) => computeParity(sql));
    expect(again.overallPct).toBe(result.overallPct);
  }, T);

  it("getBannerState names income below threshold and does NOT raise a surprise alarm", async () => {
    if (!HAS_DB) {
      console.log("SKIP");
      return;
    }
    await runParityCheck(); // ensure a snapshot exists for the banner to read
    const banner = await getBannerState();
    console.log(
      `banner: overall=${banner.overallPct}% threshold=${banner.thresholdPct}% below=[${banner.below
        .map((b) => `${b.field}:${b.pct}${b.expectedUnreliable ? "*" : "!"}`)
        .join(", ")}] alarm=${banner.alarm}`,
    );

    expect(banner.thresholdPct).toBe(Number((parityThreshold() * 100).toFixed(2)));
    // income_band is named (below threshold) ...
    const incomeBelow = banner.below.find((b) => b.field === "income_band");
    expect(incomeBelow, "income_band must be flagged below threshold").toBeTruthy();
    expect(incomeBelow!.expectedUnreliable).toBe(true);
    expect(banner.expectedUnreliable).toContain("income_band");
    // ... but it is a KNOWN-unreliable field, so it does not trip the surprise alarm.
    expect(banner.surprises).not.toContain("income_band");
    expect(banner.alarm).toBe(false);
    expect(banner.overallBelow).toBe(false);
  }, T);
});
