/**
 * parity-view.ts — a PURE roll-up of app↔HubSpot parity over a `field_state` array.
 *
 * The live engine (`lib/parity.ts`) is the source of truth on real data; this is its
 * pure twin for the seeded snapshot the Hub renders from (no DB, deterministic). It
 * reuses the engine's `normalizeValue` so the comparison rule is identical, and reads
 * the expected-unreliable flag from the seeded `SYNCED_FIELDS` (which mirror the
 * `field_authority` seed) — never a hardcoded list (Wu's falsifiable ask).
 *
 * Parity scope: only the GOVERNED fields (those with a field_authority row, i.e. the
 * 9 SYNCED_FIELDS) count. Derived segmentation fields are out of scope, exactly as the
 * live engine's inner join excludes them.
 */

import { normalizeValue } from "../parity";
import { SYNCED_FIELDS } from "../seed/dictionaries";
import type { FieldState } from "../seed/types";

const EXPECTED_UNRELIABLE = new Map<string, boolean>(
  SYNCED_FIELDS.map((f) => [f.field, f.unreliable]),
);
const GOVERNED = new Set<string>(SYNCED_FIELDS.map((f) => f.field));

/** Is this field one of the seeded expected-unreliable HubSpot fields? Reads data, not code. */
export function isExpectedUnreliable(field: string): boolean {
  return EXPECTED_UNRELIABLE.get(field) ?? false;
}

export interface FieldParityView {
  field: string;
  total: number;
  inParity: number;
  pct: number; // 0–100, two decimals
  expectedUnreliable: boolean;
}

export interface ParityView {
  overallPct: number; // 0–100
  totalRows: number;
  inParityRows: number;
  /** Worst field first (asc by pct) — so the Overview can show the worst beside the overall. */
  fieldDetail: FieldParityView[];
}

const round2 = (num: number, den: number): number =>
  den === 0 ? 100 : Number(((100 * num) / den).toFixed(2));

/**
 * Roll up parity from a `field_state` array. Recomputes `in_parity` from
 * normalize(app) === normalize(hs) so cosmetic case/whitespace drift does not count
 * as a conflict — identical to the live engine.
 */
export function computeSeedParity(fieldState: FieldState[]): ParityView {
  const perField = new Map<string, { total: number; inParity: number }>();
  let totalRows = 0;
  let inParityRows = 0;

  for (const r of fieldState) {
    if (!GOVERNED.has(r.field)) continue; // only governed fields are in parity scope
    const ok = normalizeValue(r.app_value) === normalizeValue(r.hs_value);
    totalRows += 1;
    if (ok) inParityRows += 1;
    const fp = perField.get(r.field) ?? { total: 0, inParity: 0 };
    fp.total += 1;
    if (ok) fp.inParity += 1;
    perField.set(r.field, fp);
  }

  const fieldDetail: FieldParityView[] = [...perField.entries()]
    .map(([field, f]) => ({
      field,
      total: f.total,
      inParity: f.inParity,
      pct: round2(f.inParity, f.total),
      expectedUnreliable: isExpectedUnreliable(field),
    }))
    .sort((a, b) => a.pct - b.pct);

  return {
    overallPct: round2(inParityRows, totalRows),
    totalRows,
    inParityRows,
    fieldDetail,
  };
}

export interface SeedBannerState {
  overallPct: number;
  thresholdPct: number;
  overallBelow: boolean;
  below: FieldParityView[]; // every below-threshold field, worst first
  surprises: string[]; // below-threshold AND not expected_unreliable — the alarm
  expectedUnreliable: string[]; // below-threshold but known-unreliable (calm/amber)
  alarm: boolean; // true iff a surprise field is below threshold
}

/**
 * The pure twin of `getBannerState()`. `alarm` is true IFF a non-expected_unreliable
 * field is below threshold (Wu/Rahman): TEFA/income/source below threshold alone stay
 * calm (amber) and do NOT trip the alarm.
 */
export function seedBannerState(fieldState: FieldState[], thresholdPct = 95): SeedBannerState {
  const parity = computeSeedParity(fieldState);
  const below = parity.fieldDetail.filter((f) => f.pct < thresholdPct);
  const surprises = below.filter((f) => !f.expectedUnreliable).map((f) => f.field);
  const expectedUnreliable = below.filter((f) => f.expectedUnreliable).map((f) => f.field);
  return {
    overallPct: parity.overallPct,
    thresholdPct,
    overallBelow: parity.overallPct < thresholdPct,
    below,
    surprises,
    expectedUnreliable,
    alarm: surprises.length > 0,
  };
}
