/**
 * Reads the committed fixture manifest (hub/seed-data/manifest.json) at request
 * time so the Dev section shows LIVE row counts + edge cases from the last
 * `npm run seed:fixtures`. Returns null if fixtures haven't been generated yet.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SeedManifest {
  seed: number;
  generatedAt: string;
  counts: Record<string, number>;
  edgeCases: string[];
  real: string[];
  standIn: string[];
}

export async function readManifest(): Promise<SeedManifest | null> {
  try {
    const path = join(process.cwd(), "seed-data", "manifest.json");
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as SeedManifest;
  } catch {
    return null;
  }
}
