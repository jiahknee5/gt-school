import { afterAll, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../scripts/_env";
import { withProgram, withoutProgram, closeDb } from "../lib/db";

/**
 * Live-DB fixtures for the GT Marketing Hub seed (scripts/seed.ts). These assert
 * the spec-mandated MARGINAL rates (PRD Module 1 / 5 / 10) against the real
 * Supabase rows, plus the presence of every Phase-1 stress case. Run order:
 *   npm run seed   # populate the live DB
 *   npm test       # (or npx vitest run tests/seed-fixtures.test.ts)
 *
 * Tolerance is ±5 points unless a tighter/looser bound is noted inline.
 * Like the other DB tests, this skips when APP_RW_DATABASE_URL is unset.
 */

loadEnvLocal();
const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);

// Deposit conversion is reported over the FALL applicant cohort (applied or
// beyond) — NOT the whole lead universe. The spec's "clicked -> 52% commit" is a
// conditional rate; the 112 fall deposits and the ~2k-family base are different
// populations (112/2000 = 5.6% could never satisfy a 16% floor on every tier).
const COHORT = "funnel_stage in ('applicant','shadow_day','deposit')";
const AUTHORITY_FIELDS =
  "('income_band','tefa_status','source','grade','funnel_stage','lead_score','lifecycle_stage','email')";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v);

afterAll(async () => {
  if (HAS_DB) await closeDb();
});

const guard = () => {
  if (!HAS_DB) {
    console.log("SKIP: APP_RW_DATABASE_URL not set (run after `npm run seed`).");
    return true;
  }
  return false;
};

/** Deposit rate (%) grouped by an attribute, over the fall applicant cohort. */
async function depositRateByColumn(col: string): Promise<Map<string, { n: number; rate: number }>> {
  const rows = (await withoutProgram((sql) =>
    sql.unsafe(
      `select ${col} as k, count(*)::int n, count(*) filter (where funnel_stage='deposit')::int dep
       from families where ${COHORT} group by ${col}`,
    ),
  )) as Row[];
  const m = new Map<string, { n: number; rate: number }>();
  for (const r of rows) m.set(String(r.k), { n: num(r.n), rate: (100 * num(r.dep)) / num(r.n) });
  return m;
}
/** Same, but the attribute lives in field_state (engagement_tier / geo / segment). */
async function depositRateByFieldState(field: string): Promise<Map<string, { n: number; rate: number }>> {
  const rows = (await withoutProgram((sql) =>
    sql.unsafe(
      `select fs.app_value as k, count(*)::int n, count(*) filter (where f.funnel_stage='deposit')::int dep
       from families f join field_state fs
         on fs.entity='family' and fs.entity_id=f.id and fs.field='${field}'
       where f.${COHORT} group by fs.app_value`,
    ),
  )) as Row[];
  const m = new Map<string, { n: number; rate: number }>();
  for (const r of rows) m.set(String(r.k), { n: num(r.n), rate: (100 * num(r.dep)) / num(r.n) });
  return m;
}
async function programIds() {
  const progs = (await withoutProgram((sql) => sql`select id, key from programs`)) as Row[];
  return {
    fall: String(progs.find((p) => p.key === "fall_enrollment")!.id),
    summer: String(progs.find((p) => p.key === "summer_camp")!.id),
  };
}

describe("seed fixtures — volume & deposit total", () => {
  it("has ~2,000 families and exactly the 112-deposit fall total", async () => {
    if (guard()) return;
    const [{ n: fams }] = (await withoutProgram((s) => s`select count(*)::int n from families`)) as Row[];
    const [{ n: dep }] = (await withoutProgram(
      (s) => s`select count(*)::int n from families where funnel_stage='deposit'`,
    )) as Row[];
    expect(num(fams)).toBeGreaterThanOrEqual(1800);
    expect(num(fams)).toBeLessThanOrEqual(2200);
    expect(num(dep)).toBeGreaterThanOrEqual(108); // "Deposits vs Fall goal" reads 112/180
    expect(num(dep)).toBeLessThanOrEqual(116);
  });
});

describe("seed fixtures — engagement tier is the top predictor (52/30/16)", () => {
  it("clicked ~52%, opened ~30%, cold ~16%, strictly monotonic", async () => {
    if (guard()) return;
    const m = await depositRateByFieldState("engagement_tier");
    const clicked = m.get("clicked")!.rate;
    const opened = m.get("opened")!.rate;
    const cold = m.get("cold")!.rate;
    expect(clicked).toBeGreaterThanOrEqual(47);
    expect(clicked).toBeLessThanOrEqual(57);
    expect(opened).toBeGreaterThanOrEqual(25);
    expect(opened).toBeLessThanOrEqual(35);
    expect(cold).toBeGreaterThanOrEqual(11);
    expect(cold).toBeLessThanOrEqual(21);
    expect(clicked).toBeGreaterThan(opened);
    expect(opened).toBeGreaterThan(cold);
  });
});

describe("seed fixtures — income is the master variable (160K+ ~25% regardless of geo)", () => {
  it("the 160K+ slice converts ~25%", async () => {
    if (guard()) return;
    const m = await depositRateByColumn("income_band");
    const hi = m.get("160K+")!.rate;
    expect(hi).toBeGreaterThanOrEqual(20);
    expect(hi).toBeLessThanOrEqual(30);
  });
  it("160K+ converts ~the same in TX and out-of-state", async () => {
    if (guard()) return;
    const rows = (await withoutProgram((s) =>
      s.unsafe(
        `select fs.app_value geo, count(*)::int n, count(*) filter (where f.funnel_stage='deposit')::int dep
         from families f join field_state fs on fs.entity='family' and fs.entity_id=f.id and fs.field='geo'
         where f.${COHORT} and f.income_band='160K+' group by fs.app_value`,
      ),
    )) as Row[];
    const byGeo = new Map(rows.map((r) => [String(r.geo), (100 * num(r.dep)) / num(r.n)]));
    const tx = byGeo.get("TX")!;
    const oos = byGeo.get("OOS")!;
    // small cell (n~60/geo) -> ±7 of 25, and geo must not flip the story
    for (const r of [tx, oos]) {
      expect(r).toBeGreaterThanOrEqual(18);
      expect(r).toBeLessThanOrEqual(32);
    }
    expect(Math.abs(tx - oos)).toBeLessThan(10);
  });
});

describe("seed fixtures — geo split, channel, grade", () => {
  it("TX vs out-of-state is ~50/50", async () => {
    if (guard()) return;
    const rows = (await withoutProgram((s) =>
      s.unsafe(
        `select fs.app_value geo, count(*)::int n from families f
         join field_state fs on fs.entity='family' and fs.entity_id=f.id and fs.field='geo' group by fs.app_value`,
      ),
    )) as Row[];
    const total = rows.reduce((s, r) => s + num(r.n), 0);
    const tx = num(rows.find((r) => r.geo === "TX")!.n);
    const pct = (100 * tx) / total;
    expect(pct).toBeGreaterThanOrEqual(45);
    expect(pct).toBeLessThanOrEqual(55);
  });
  it("X is the top converter (~42%); Facebook is the high-volume low-conversion trap", async () => {
    if (guard()) return;
    const m = await depositRateByColumn("source");
    const entries = [...m.entries()];
    const top = entries.sort((a, b) => b[1].rate - a[1].rate)[0];
    expect(top[0]).toBe("x");
    expect(m.get("x")!.rate).toBeGreaterThanOrEqual(37);
    expect(m.get("x")!.rate).toBeLessThanOrEqual(47);
    const biggest = entries.sort((a, b) => b[1].n - a[1].n)[0];
    expect(biggest[0]).toBe("facebook"); // highest volume
    expect(m.get("facebook")!.rate).toBeLessThan(14); // ...but a conversion trap
  });
  it("K-2 is the sweet spot; 9-12 is dead", async () => {
    if (guard()) return;
    const rows = (await withoutProgram((s) =>
      s.unsafe(
        `select case when grade in ('K','1','2') then 'K-2'
                     when grade in ('9','10','11','12') then '9-12' else 'mid' end bucket,
           count(*)::int n, count(*) filter (where funnel_stage='deposit')::int dep
         from families where ${COHORT} group by 1`,
      ),
    )) as Row[];
    const m = new Map(rows.map((r) => [String(r.bucket), (100 * num(r.dep)) / num(r.n)]));
    expect(m.get("K-2")!).toBeGreaterThanOrEqual(28); // sweet spot
    expect(m.get("9-12")!).toBeLessThanOrEqual(3); // near-zero, dead grades
    expect(m.get("K-2")!).toBeGreaterThan(m.get("mid")!);
    expect(m.get("mid")!).toBeGreaterThan(m.get("9-12")!);
  });
});

describe("seed fixtures — T2/T3 segments (asserted loosely, ±20%)", () => {
  it("T2:T3 ~ 3100:1124 with T2 the dominant cohort", async () => {
    if (guard()) return;
    const rows = (await withoutProgram((s) =>
      s.unsafe(
        `select fs.app_value seg, count(*)::int n from families f
         join field_state fs on fs.entity='family' and fs.entity_id=f.id and fs.field='segment' group by fs.app_value`,
      ),
    )) as Row[];
    const m = new Map(rows.map((r) => [String(r.seg), num(r.n)]));
    const t2 = m.get("T2")!;
    const t3 = m.get("T3")!;
    const ratio = t2 / t3;
    const target = 3100 / 1124; // 2.758
    expect(ratio).toBeGreaterThanOrEqual(target * 0.8);
    expect(ratio).toBeLessThanOrEqual(target * 1.2);
    expect(t2).toBeGreaterThan(t3);
    expect(t3).toBeGreaterThan(m.get("T1")!);
  });
});

describe("seed fixtures — CRM Ops sync parity (income low, overall healthy)", () => {
  it("income_band field parity is below threshold while overall stays healthy", async () => {
    if (guard()) return;
    const [overall] = (await withoutProgram((s) =>
      s.unsafe(
        `select round(100.0*count(*) filter (where in_parity)/count(*),2) pct
         from field_state where field in ${AUTHORITY_FIELDS}`,
      ),
    )) as Row[];
    const [income] = (await withoutProgram((s) =>
      s.unsafe(
        `select round(100.0*count(*) filter (where in_parity)/count(*),2) pct
         from field_state where field='income_band'`,
      ),
    )) as Row[];
    expect(num(income.pct)).toBeGreaterThanOrEqual(60);
    expect(num(income.pct)).toBeLessThan(95);
    expect(num(overall.pct)).toBeGreaterThanOrEqual(95);
    expect(num(overall.pct)).toBeLessThanOrEqual(100);
    const [snap] = (await withoutProgram(
      (s) => s`select overall_pct from parity_snapshot order by taken_at desc limit 1`,
    )) as Row[];
    expect(num(snap.overall_pct)).toBeGreaterThanOrEqual(95);
  });
});

describe("seed fixtures — budget reconciles to $365K with guerrilla >10% over", () => {
  it("planned + committed both sum to 365,000 and only guerrilla is >10% over plan", async () => {
    if (guard()) return;
    const rows = (await withoutProgram(
      (s) => s`select key, planned::float planned, committed::float committed from budget_workstream`,
    )) as Row[];
    const sumPlanned = rows.reduce((s, r) => s + num(r.planned), 0);
    const sumCommitted = rows.reduce((s, r) => s + num(r.committed), 0);
    expect(sumPlanned).toBe(365000);
    expect(sumCommitted).toBe(365000);
    const over = rows.filter((r) => num(r.committed) > num(r.planned) * 1.1);
    expect(over.length).toBe(1);
    expect(over[0].key).toBe("guerrilla");
    const g = rows.find((r) => r.key === "guerrilla")!;
    expect((num(g.committed) - num(g.planned)) / num(g.planned)).toBeGreaterThan(0.1);
  });
});

describe("seed fixtures — Phase-1 stress cases all present", () => {
  it("a family is enrolled in BOTH programs (RLS-scoped reads, intersected)", async () => {
    if (guard()) return;
    const { fall, summer } = await programIds();
    const fallFams = await withProgram(fall, async (s) =>
      ((await s`select distinct family_id from program_membership`) as Row[]).map((r) => String(r.family_id)),
    );
    const summerFams = await withProgram(summer, async (s) =>
      ((await s`select distinct family_id from program_membership`) as Row[]).map((r) => String(r.family_id)),
    );
    const both = fallFams.filter((id) => summerFams.includes(id));
    expect(both.length).toBeGreaterThanOrEqual(1);
  });
  it("two parent-families share one child (the camp seat counts once)", async () => {
    if (guard()) return;
    const { summer } = await programIds();
    const dup = await withProgram(summer, async (s) =>
      (await s`select child_id, count(*)::int c from program_membership
               where child_id is not null group by child_id having count(*) > 1`) as Row[],
    );
    expect(dup.length).toBeGreaterThanOrEqual(1); // one child, two parent-families
  });
  it("a family has two children (spanning the two programs)", async () => {
    if (guard()) return;
    const multi = (await withoutProgram(
      (s) => s`select family_id from children group by family_id having count(*) >= 2`,
    )) as Row[];
    expect(multi.length).toBeGreaterThanOrEqual(1);
  });
  it("a dual-source duplicate exists (one match_key, two families, two source systems)", async () => {
    if (guard()) return;
    const dupKeys = (await withoutProgram(
      (s) => s`select match_key from families where match_key is not null group by match_key having count(*) >= 2`,
    )) as Row[];
    expect(dupKeys.length).toBeGreaterThanOrEqual(1);
    const systems = (await withoutProgram(
      (s) => s`select distinct system from sync_identity_map where system in ('summer_site','community')`,
    )) as Row[];
    expect(systems.length).toBe(2);
  });
  it("payment stress: duplicate intent is a no-op, refund-then-succeeded does NOT regress", async () => {
    if (guard()) return;
    const { fall } = await programIds();
    const res = await withProgram(fall, async (s) => {
      const [dup] = (await s`select count(*)::int n from payments where stripe_payment_intent_id='pi_stress_dup'`) as Row[];
      const [re] = (await s`select status, status_rank from payments where stripe_payment_intent_id='pi_stress_reorder'`) as Row[];
      const [failed] = (await s`select count(*)::int n from payments where status='failed'`) as Row[];
      const [late] = (await s`select count(*)::int n from payments
        where stripe_payment_intent_id='pi_stress_late' and occurred_at > '2026-08-17'`) as Row[];
      return { dup: num(dup.n), reStatus: re.status, reRank: num(re.status_rank), failed: num(failed.n), late: num(late.n) };
    });
    expect(res.dup).toBe(1); // 2nd identical insert was a no-op via the unique constraint
    expect(res.reStatus).toBe("refunded"); // terminal rank-3 not regressed by a late succeeded(2)
    expect(res.reRank).toBe(3);
    expect(res.failed).toBeGreaterThanOrEqual(1);
    expect(res.late).toBe(1);
  });
  it("data-quality queue has a permanent UTM-broken item + an auto-detected sync-drift item", async () => {
    if (guard()) return;
    const cats = (await withoutProgram(
      (s) => s`select distinct category from data_quality_issue`,
    )) as Row[];
    const set = new Set(cats.map((r) => String(r.category)));
    expect(set.has("utm")).toBe(true);
    expect(set.has("sync")).toBe(true);
  });
  it("decisions queue has >=3 open items including an auto-flagged budget-variance decision", async () => {
    if (guard()) return;
    const [d] = (await withoutProgram(
      (s) => s`select count(*)::int total, count(*) filter (where auto_flag)::int af from decisions where status='open'`,
    )) as Row[];
    expect(num(d.total)).toBeGreaterThanOrEqual(3);
    expect(num(d.af)).toBeGreaterThanOrEqual(1);
  });
  it("garbled/missing records exist (mojibake names, null income/grade)", async () => {
    if (guard()) return;
    const [m] = (await withoutProgram(
      (s) => s`select count(*)::int n from families where income_band is null or grade is null`,
    )) as Row[];
    expect(num(m.n)).toBeGreaterThanOrEqual(5);
  });
});
