// Phase 1 single-source-of-truth (SSOT) guard tests.
//
// These are PURE — no live DB writes, no network — so they pass in `test:ci`, which
// runs with NO APP_RW_DATABASE_URL. They pin three backbone invariants:
//   1. the seed is reseedable: generate() is deterministic, and loadDataset() renders
//      the same baseline shape WITHOUT a DB (the CI fallback path),
//   2. the HubSpot <-> internal-DB sync is wired (outbox drain + reconcile + parity,
//      cron-gated), and dispatches the app->HubSpot op vocabulary,
//   3. every tab reads the internal DB via loadDataset(), never the in-memory generate().

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { loadDataset } from "@/lib/seed/load-dataset";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");

const SEED_OPTS = { seed: 424242, families: 1200 } as const;

// ----------------------------------------------------------------------------
// 1. data can be reseeded (deterministic + safe fallback)
// ----------------------------------------------------------------------------
describe("data can be reseeded (deterministic + safe fallback)", () => {
  it("generate() is deterministic — a reseed reproduces the known backbone", () => {
    const a = generate({ ...SEED_OPTS });
    const b = generate({ ...SEED_OPTS });

    // Identical volume: same families and enrollments on every run.
    expect(a.families.length).toBe(b.families.length);
    expect(a.enrollments.length).toBe(b.enrollments.length);

    // Identical $365K backbone: budget recommended reconciles to the known total,
    // and reproduces byte-for-byte across reseeds.
    const recommended = (ds: ReturnType<typeof generate>): number =>
      ds.budget_workstream.reduce((sum, w) => sum + w.recommended, 0);
    expect(recommended(a)).toBe(365000);
    expect(recommended(a)).toBe(recommended(b));
  });

  describe("loadDataset() renders the reseedable baseline without a DB", () => {
    let savedDbUrl: string | undefined;

    beforeAll(() => {
      // CI has no APP_RW_DATABASE_URL; force that path locally too so this proves the
      // no-DB fallback (loadDataset returns the generate() twin wholesale).
      savedDbUrl = process.env.APP_RW_DATABASE_URL;
      delete process.env.APP_RW_DATABASE_URL;
    });

    afterAll(() => {
      if (savedDbUrl !== undefined) process.env.APP_RW_DATABASE_URL = savedDbUrl;
    });

    it("equals the generate() shape — same family count and same SeedDataset keys", async () => {
      const gen = generate({ ...SEED_OPTS });
      const loaded = await loadDataset({ ...SEED_OPTS });

      // Same family count as the deterministic twin (the 1200-family config baseline).
      expect(loaded.families.length).toBe(gen.families.length);
      expect(gen.families.length).toBeGreaterThanOrEqual(1200);

      // Exact same SeedDataset key set — no table is dropped or added on the no-DB path.
      expect(Object.keys(loaded).sort()).toEqual(Object.keys(gen).sort());
    });
  });
});

// ----------------------------------------------------------------------------
// 2. HubSpot <-> internal DB sync is wired
// ----------------------------------------------------------------------------
describe("HubSpot <-> internal DB sync is wired", () => {
  it("drainOutbox() is an async worker that accepts a dispatch override + dedupeKeyLike filter", async () => {
    const { drainOutbox } = await import("@/lib/sync/outbox-worker");
    expect(typeof drainOutbox).toBe("function");
    // Async by construction — it drains over a DB transaction.
    expect(drainOutbox.constructor.name).toBe("AsyncFunction");

    // The override + scoping seams that tests inject through are part of its options.
    const worker = read("lib/sync/outbox-worker.ts");
    expect(worker).toMatch(/dispatch\?:/);
    expect(worker).toMatch(/dedupeKeyLike\?:/);
  });

  it("the outbox dispatches the app->HubSpot op vocabulary (upsert_contact + patch_deal)", () => {
    const worker = read("lib/sync/outbox-worker.ts");
    expect(worker).toContain("upsert_contact");
    expect(worker).toContain("patch_deal");
  });

  it("the sync-drain cron runs all three steps behind a CRON_SECRET gate", () => {
    const route = read("app/api/cron/sync-drain/route.ts");
    // The three sync steps: outbound drain, inbound reconcile, parity recompute.
    expect(route).toContain("drainOutbox");
    expect(route).toContain("reconcile");
    expect(route).toContain("runParityCheck");
    // The cron authorization gate.
    expect(route).toContain("authorizeCron");
    expect(route).toContain("CRON_SECRET");
  });

  it("vercel.json schedules the sync-drain cron", () => {
    const vercel = JSON.parse(read("vercel.json")) as { crons?: { path?: string }[] };
    const paths = (vercel.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/sync-drain");
  });
});

// ----------------------------------------------------------------------------
// 3. every tab reads the internal DB (loadDataset), not in-memory generate()
// ----------------------------------------------------------------------------
describe("every tab reads the internal DB (loadDataset), not in-memory generate()", () => {
  // Discover every render page: app/page.tsx, app/m/[slug]/page.tsx, app/m/*/page.tsx.
  const mDir = join(REPO_ROOT, "app/m");
  const pageFiles: string[] = ["app/page.tsx"];
  for (const entry of readdirSync(mDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = join("app/m", entry.name, "page.tsx");
    if (existsSync(join(REPO_ROOT, rel))) pageFiles.push(rel);
  }

  // An ACTUAL invocation: `generate(` immediately followed by `{` or `)`. This skips
  // type positions like `ReturnType<typeof generate>` (nurture/page.tsx) and property
  // keys like `generate: {` (status/page.tsx), and never matches `generateMetadata(`.
  const GENERATE_CALL = /\bgenerate\s*\(\s*[{)]/;

  it("discovers the render pages", () => {
    // Sanity: we found the home page plus the module pages (incl. the [slug] catch-all).
    expect(pageFiles.length).toBeGreaterThan(10);
    expect(pageFiles).toContain("app/page.tsx");
    expect(pageFiles.some((p) => p.includes("[slug]"))).toBe(true);
  });

  for (const rel of pageFiles) {
    it(`${rel} reads the DB via loadDataset and never calls generate()`, () => {
      const src = read(rel);
      expect(src, `${rel} must import loadDataset (the single DB source)`).toContain(
        '@/lib/seed/load-dataset',
      );
      expect(
        GENERATE_CALL.test(src),
        `${rel} must NOT call the in-memory generate() — read the DB via loadDataset`,
      ).toBe(false);
    });
  }
});
