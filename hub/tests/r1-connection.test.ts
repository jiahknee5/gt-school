import { afterAll, describe, expect, it } from "vitest";
import { closeDb, withProgram, withoutProgram } from "../lib/db";

const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);

describe("R1 — app_rw program-isolation connection smoke test", () => {
  afterAll(async () => {
    if (HAS_DB) await closeDb();
  });

  it("scopes reads to one program and fails closed when unscoped", async () => {
    if (!HAS_DB) {
      // Suite must be green before Supabase exists; this is the documented skip.
      console.log(
        "SKIP: APP_RW_DATABASE_URL not set (run after Supabase is provisioned)",
      );
      expect(HAS_DB).toBe(false);
      return;
    }

    // Global programs table (not RLS-scoped) gives us real program ids.
    const programs = await withoutProgram(
      (sql) => sql<{ id: string; key: string }[]>`select id, key from programs`,
    );
    const summer = programs.find((p) => p.key === "summer_camp");
    const other = programs.find((p) => p.key !== "summer_camp");
    expect(summer, "summer_camp must be seeded by 0001_backbone.sql").toBeTruthy();

    // (a) Program-scoped: RLS returns only this program's enrollments, and a
    //     WHERE for a DIFFERENT program cannot widen past the policy → 0.
    const scoped = await withProgram(summer!.id, async (sql) => {
      const [own] = await sql<{ count: number }[]>`
        select count(*)::int as count from enrollments`;
      let crossCount = 0;
      if (other) {
        const [cross] = await sql<{ count: number }[]>`
          select count(*)::int as count
          from enrollments
          where program_id = ${other.id}`;
        crossCount = cross.count;
      }
      return { ownCount: own.count, crossCount };
    });
    expect(scoped.ownCount).toBeGreaterThanOrEqual(0);
    expect(scoped.crossCount).toBe(0);

    // (b) Unscoped (no GUC set): FORCE RLS predicate is NULL → fail-closed → 0 rows.
    const [unscoped] = await withoutProgram(
      (sql) => sql<{ count: number }[]>`
        select count(*)::int as count from enrollments`,
    );
    expect(unscoped.count).toBe(0);
  });
});
