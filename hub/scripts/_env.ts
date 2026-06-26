import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Standalone scripts/tests don't get Next.js's automatic .env.local loading, and
 * `node --env-file` is only applied when the caller remembers the flag. This loads
 * hub/.env.local (a symlink to the repo-root env file) into process.env for any key
 * not already set — so `node scripts/seed.ts`, `node --env-file=… scripts/seed.ts`,
 * and `vitest run` all see APP_RW_DATABASE_URL identically. Existing env wins.
 */
export function loadEnvLocal(): void {
  const here = dirname(fileURLToPath(import.meta.url)); // hub/scripts
  const envPath = join(here, "..", ".env.local"); // hub/.env.local
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return; // no .env.local — rely on whatever the process already has
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
