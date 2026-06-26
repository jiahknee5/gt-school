/**
 * detect.ts — the CRM Ops auto-detector (the module's reason to exist).
 *
 * After a `reconcile()`/parity recompute, this scans the resulting state for
 *   (a) sync drift   — governed fields below the parity threshold, and
 *   (b) UTM breakage — families whose `source` is (not set)/malformed, and
 *   (c) identity collisions — families sharing a match_key (would inflate parity),
 * and turns each into a `data_quality_issue`. It is IDEMPOTENT: the desired set of
 * open issues is keyed by a `(category, entity, entity_id, field)` signature, so a
 * rerun over unchanged state opens 0 new issues and resolves 0 (Ostrowski #4).
 *
 * This file is PURE — it derives the plan from data and never performs I/O. The plan
 * (`toOpen` / `toResolve`) is what a live writer would apply against
 * `data_quality_issue`. NB: in the committed backbone, `data_quality_issue` is not
 * granted INSERT/UPDATE to `app_rw` (see supabase/migrations/0001_backbone.sql) and
 * the build is additive-only, so the live write path is intentionally deferred to an
 * additive grant migration (tracked as a Tier-1 blocker). The detector's behavior —
 * which is the falsifiable ask — is fully exercised here and in tests over the
 * deterministic seed snapshot.
 *
 * PII rule (Schwartz #8): issue descriptions reference a field name + entity_id only —
 * never a raw TEFA/income/child value.
 */

import type { DataQualityIssue, SeedDataset } from "../seed/types";
import { computeSeedParity } from "./parity-view";

export type IssueCategory = "utm" | "sync" | "scoring" | "tracking" | "other";
export type IssueSeverity = "low" | "medium" | "high" | "blocker";

export interface IssueSignature {
  category: string;
  entity: string;
  entity_id: string;
  field: string;
}

export interface DetectedIssue extends IssueSignature {
  severity: IssueSeverity;
  description: string;
}

/** The minimal shape of an existing issue row the planner needs (live row or seed row). */
export interface ExistingIssueRow {
  category: string;
  entity: string | null;
  entity_id: string | null;
  field: string | null;
  status: string;
}

export interface DetectPlan {
  desired: DetectedIssue[]; // the full set the detector wants open right now
  toOpen: DetectedIssue[]; // desired ∖ already-open (the inserts)
  toResolve: IssueSignature[]; // auto-rows currently open whose condition cleared
}

export const DEFAULT_THRESHOLD_PCT = 95;

const sigKey = (s: IssueSignature): string =>
  `${s.category}|${s.entity}|${s.entity_id}|${s.field}`;

/** A `source` value is broken if it is missing, empty, a sentinel, or an unrendered UTM template. */
export function isMalformedSource(source: string | null | undefined): boolean {
  if (source == null) return true;
  const s = source.trim().toLowerCase();
  return (
    s === "" ||
    s === "(none)" ||
    s === "(not set)" ||
    s === "unknown" ||
    s.includes("{{") ||
    s.includes("}}")
  );
}

/**
 * Compute the FULL set of issues the detector wants open, given a snapshot. Pure.
 * Deterministic ordering (UTM by family id, sync worst-first, dup by family id) so the
 * plan is byte-stable for a given dataset.
 */
export function computeDesiredIssues(
  ds: SeedDataset,
  thresholdPct: number = DEFAULT_THRESHOLD_PCT,
): DetectedIssue[] {
  const desired: DetectedIssue[] = [];

  // (b) UTM breakage — one issue per family with a (not set)/malformed source.
  for (const f of [...ds.families].sort((a, b) => a.id.localeCompare(b.id))) {
    if (isMalformedSource(f.source)) {
      desired.push({
        category: "utm",
        entity: "family",
        entity_id: f.id,
        field: "source",
        severity: "high",
        description: `UTM source unresolved (not set or malformed) for family ${f.id}.`,
      });
    }
  }

  // (a) Sync drift — one issue per governed field below threshold. A surprise
  //     (non-expected_unreliable) is high; a known-unreliable field is low (calm).
  const parity = computeSeedParity(ds.field_state);
  for (const fd of parity.fieldDetail) {
    if (fd.pct >= thresholdPct) continue;
    desired.push({
      category: "sync",
      entity: "field",
      entity_id: fd.field,
      field: fd.field,
      severity: fd.expectedUnreliable ? "low" : "high",
      description: `Sync parity for '${fd.field}' is ${fd.pct}% (below the ${thresholdPct}% threshold)${
        fd.expectedUnreliable ? " — known-unreliable field." : " — unexpected drift."
      }`,
    });
  }

  // (c) Identity collisions — a match_key shared by ≥2 families. The duplicates
  //     surface as issues so they are NOT silently double-counted in parity (Kim #5).
  const byKey = new Map<string, string[]>();
  for (const f of ds.families) {
    if (!f.match_key) continue;
    byKey.set(f.match_key, [...(byKey.get(f.match_key) ?? []), f.id]);
  }
  for (const [, ids] of byKey) {
    if (ids.length < 2) continue;
    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    // keep the first as the golden record; flag the rest as duplicates.
    for (const dupId of sorted.slice(1)) {
      desired.push({
        category: "other",
        entity: "family",
        entity_id: dupId,
        field: "match_key",
        severity: "medium",
        description: `Possible duplicate identity: family ${dupId} shares a match_key with ${
          ids.length - 1
        } other record(s); resolve before it skews parity.`,
      });
    }
  }

  return desired;
}

/**
 * Diff the desired set against what is already open to produce an idempotent plan.
 * Only auto-detector-shaped rows (entity + entity_id + field all present) are eligible
 * for auto-resolution, so manual/system issues are never touched by the detector.
 */
export function deriveDetectPlan(
  desired: DetectedIssue[],
  existing: ExistingIssueRow[],
): DetectPlan {
  // Dedupe desired by signature (idempotent within a single run).
  const desiredBySig = new Map<string, DetectedIssue>();
  for (const d of desired) desiredBySig.set(sigKey(d), d);
  const dedupedDesired = [...desiredBySig.values()];
  const desiredKeys = new Set(desiredBySig.keys());

  const openAuto = existing.filter(
    (e) => e.status === "open" && e.entity != null && e.entity_id != null && e.field != null,
  );
  const openKeys = new Set(
    openAuto.map((e) =>
      sigKey({ category: e.category, entity: e.entity!, entity_id: e.entity_id!, field: e.field! }),
    ),
  );

  const toOpen = dedupedDesired.filter((d) => !openKeys.has(sigKey(d)));
  const toResolve: IssueSignature[] = openAuto
    .map((e) => ({
      category: e.category,
      entity: e.entity!,
      entity_id: e.entity_id!,
      field: e.field!,
    }))
    .filter((s) => !desiredKeys.has(sigKey(s)));

  return { desired: dedupedDesired, toOpen, toResolve };
}

export interface DetectResult {
  thresholdPct: number;
  desiredCount: number;
  openedCount: number;
  resolvedCount: number;
  byCategory: Record<string, number>;
  plan: DetectPlan;
}

/**
 * Run the detector over a dataset + the issues already on record. Returns a summary
 * plus the plan. Running this twice with the existing rows updated to include the first
 * run's output yields openedCount === 0 (the idempotency contract).
 */
export function runDetect(
  ds: SeedDataset,
  existing: ExistingIssueRow[] = ds.data_quality_issue,
  thresholdPct: number = DEFAULT_THRESHOLD_PCT,
): DetectResult {
  const desired = computeDesiredIssues(ds, thresholdPct);
  const plan = deriveDetectPlan(desired, existing);
  const byCategory: Record<string, number> = {};
  for (const d of plan.desired) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
  return {
    thresholdPct,
    desiredCount: plan.desired.length,
    openedCount: plan.toOpen.length,
    resolvedCount: plan.toResolve.length,
    byCategory,
    plan,
  };
}

/** Project a DetectedIssue into a DataQualityIssue row shape (id derived from its signature). */
export function asIssueRow(d: DetectedIssue, createdAt: string): DataQualityIssue {
  return {
    id: `auto-${d.category}-${d.entity_id}-${d.field}`,
    category: d.category,
    severity: d.severity,
    entity: d.entity,
    entity_id: d.entity_id,
    field: d.field,
    description: d.description,
    status: "open",
    created_at: createdAt,
    resolved_at: null,
  };
}
