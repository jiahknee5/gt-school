/**
 * Reads an optional vitest JSON report (hub/seed-data/test-results.json) so the
 * Test Theater can show LIVE pass/fail/todo per use case. Generate it with:
 *   npm run test:report
 * Returns null if it hasn't been run — the page still renders from the catalog.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

type RawStatus = "passed" | "failed" | "pending" | "skipped" | "todo";
export type UcStatus = "passed" | "failed" | "todo" | "skipped";

interface VitestAssertion {
  title?: string;
  fullName?: string;
  status?: RawStatus;
}
interface VitestSuite {
  assertionResults?: VitestAssertion[];
}
interface VitestReport {
  startTime?: number;
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  testResults?: VitestSuite[];
}

export interface TestResults {
  generatedAt: string | null;
  total: number;
  passed: number;
  failed: number;
  todo: number;
  skipped: number;
  /** UC-id → last-run status, parsed from test titles. */
  byId: Record<string, UcStatus>;
}

function normalize(s: RawStatus | undefined): UcStatus {
  if (s === "passed" || s === "failed" || s === "todo") return s;
  return "skipped"; // pending | skipped | undefined
}

export async function readTestResults(): Promise<TestResults | null> {
  let report: VitestReport;
  try {
    const path = join(process.cwd(), "seed-data", "test-results.json");
    report = JSON.parse(await readFile(path, "utf8")) as VitestReport;
  } catch {
    return null;
  }

  const byId: Record<string, UcStatus> = {};
  for (const suite of report.testResults ?? []) {
    for (const a of suite.assertionResults ?? []) {
      const name = a.title ?? a.fullName ?? "";
      const m = name.match(/UC-[A-Z0-9-]+/);
      if (m) byId[m[0]] = normalize(a.status);
    }
  }

  return {
    generatedAt: report.startTime ? new Date(report.startTime).toISOString() : null,
    total: report.numTotalTests ?? 0,
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    todo: report.numTodoTests ?? 0,
    skipped: report.numPendingTests ?? 0,
    byId,
  };
}
