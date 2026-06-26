import { withProgram, withoutProgram } from "../lib/db";

/**
 * Clear every DYNAMIC (generated) row while leaving the 0001 migration seeds
 * intact (programs, the 4 budget_workstream rows, the 9 field_authority rows).
 * Budget committed/actual are reset to 0; recommended/planned (the migration
 * seed) are kept.
 *
 * This lives in its own module (no auto-run) so it can be imported by BOTH
 * scripts/seed.ts and scripts/reset.ts without their `isMain` auto-run guards
 * colliding when esbuild bundles one entry that imports the other.
 *
 * We DELETE rather than TRUNCATE: app_rw is NOBYPASSRLS and is NOT the table
 * owner, so it lacks the TRUNCATE privilege. DELETE runs under the same
 * authority the app uses — and for the 3 RLS-FORCEd tables (program_membership,
 * enrollments, payments) a DELETE only touches the current program's rows, so
 * we loop per program inside withProgram (an unscoped DELETE there hits 0 rows).
 *
 * FK order matters: payments -> enrollments -> program_membership (scoped)
 * before children -> families (global), because the three scoped tables
 * reference both families and children with no ON DELETE CASCADE.
 */
export async function clearGenerated(
  programs: { id: string; key: string }[],
): Promise<void> {
  for (const p of programs) {
    await withProgram(p.id, async (sql) => {
      await sql`delete from payments`;
      await sql`delete from enrollments`;
      await sql`delete from program_membership`;
    });
  }

  await withoutProgram(async (sql) => {
    await sql`delete from sync_event_log`;
    await sql`delete from sync_identity_map`;
    await sql`delete from data_quality_issue`;
    await sql`delete from parity_snapshot`;
    await sql`delete from field_state`;
    await sql`delete from decisions`;
    await sql`delete from budget_entry`;
    await sql`delete from sync_outbox`;
    await sql`delete from processed_events`;
    await sql`delete from children`;
    await sql`delete from families`;
    await sql`update budget_workstream set committed = 0, actual = 0`;
  });
}
