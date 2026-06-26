import { pathToFileURL } from "node:url";
import { loadEnvLocal } from "./_env";
import { withoutProgram, closeDb } from "../lib/db";
import { clearGenerated } from "./clear";

loadEnvLocal();

/**
 * Truncate the dynamic tables and reset budget committed/actual to 0, leaving the
 * 0001 migration seeds (programs, budget rows, field_authority) intact. To
 * repopulate afterwards, run `npm run seed` (seed clears first, so it is safe to
 * run directly — this script is just the standalone "empty it out" path).
 */
async function main(): Promise<void> {
  const programs = await withoutProgram(
    (sql) => sql<{ id: string; key: string }[]>`select id, key from programs`,
  );
  if (programs.length === 0) {
    throw new Error("No programs found — run 0001_backbone.sql first.");
  }
  console.log("reset: clearing generated rows (migration seeds preserved)…");
  await clearGenerated(programs);
  console.log("reset: done. Dynamic tables empty; budget committed/actual = 0.");
  console.log("reset: run `npm run seed` to repopulate.");
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error("reset failed:", err);
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
