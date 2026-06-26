import { withoutProgram, type ScopedSql } from "./db";

/**
 * parity.ts — the data-confidence engine behind the CRM Ops banner.
 *
 * Parity is an app↔HubSpot concept: for every field the sync policy governs
 * (field_authority), field_state holds the app value and the last-known HubSpot
 * value. This module:
 *
 *   1. computeParity()  — reads field_state for GOVERNED fields (joined to
 *      field_authority), NORMALIZES both sides, and recomputes in_parity =
 *      norm(app) == norm(hs). Rolls up per-field %, per-record %, and overall %.
 *      Pure read; no writes — safe to call from a banner render path.
 *   2. runParityCheck() — computeParity + persist: write back the recomputed
 *      in_parity / last_checked_at for any rows whose flag changed, then INSERT a
 *      parity_snapshot row (the time series the trend chart + banner read).
 *   3. getBannerState() — what the CRM Ops banner + module banners read. Returns
 *      the below-threshold field(s) + overall %, honoring expected_unreliable:
 *      a known-unreliable field still reports its TRUE number but does NOT trip a
 *      surprise alarm; a NON-expected field below threshold IS the alarm.
 *
 * Scope note: field_state also carries derived segmentation fields (geo, persona,
 * segment, engagement_tier) that have NO field_authority row — they are not sync
 * fields, so they are excluded from parity by the inner join. Parity is about the
 * fields the CRM and the app both claim to own.
 */

const DEFAULT_THRESHOLD = 0.95;

/** Threshold as a fraction (0–1). PARITY_THRESHOLD env wins; default 0.95. */
export function parityThreshold(): number {
  const raw = process.env.PARITY_THRESHOLD;
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_THRESHOLD;
}

/**
 * Normalize a stored value for comparison. Trim, lowercase, collapse internal
 * whitespace; empty/whitespace-only becomes null. Deliberately conservative — it
 * folds away cosmetic case/whitespace drift (so an app "Organic" and a HubSpot
 * "organic" agree) WITHOUT collapsing semantically-distinct sentinels like
 * "unknown" or "65-160K", which would mask real conflicts.
 */
export function normalizeValue(v: string | null | undefined): string | null {
  if (v == null) return null;
  const n = v.trim().toLowerCase().replace(/\s+/g, " ");
  return n === "" ? null : n;
}

export interface FieldParity {
  field: string;
  total: number;
  inParity: number;
  pct: number; // 0–100, two decimals
  expectedUnreliable: boolean;
}

export interface ParityResult {
  overallPct: number; // 0–100
  recordPct: number; // % of records (entities) with ALL governed fields in parity
  totalRows: number;
  inParityRows: number;
  records: number;
  recordsInParity: number;
  fields: Record<string, number>; // field -> pct (snapshot.fields shape)
  fieldDetail: FieldParity[]; // asc by pct (worst first)
  flipped: number; // rows whose in_parity changed vs what was stored
}

interface FieldStateRow {
  entity: string;
  entity_id: string;
  field: string;
  app_value: string | null;
  hs_value: string | null;
  in_parity: boolean;
  expected_unreliable: boolean;
}

/**
 * Read GOVERNED field_state rows, normalize, and roll up parity. No writes.
 * Pass `persist: true` to also write back changed in_parity flags + a snapshot.
 */
export async function computeParity(
  sql: ScopedSql,
  opts: { persist?: boolean } = {},
): Promise<ParityResult> {
  const rows = await sql<FieldStateRow[]>`
    select fs.entity, fs.entity_id, fs.field,
           fs.app_value, fs.hs_value, fs.in_parity,
           fa.expected_unreliable
    from field_state fs
    join field_authority fa
      on fa.entity = fs.entity and fa.field = fs.field`;

  const perField = new Map<string, { total: number; inParity: number; expected: boolean }>();
  const perRecord = new Map<string, boolean>(); // entity_id -> all-in-parity-so-far
  let totalRows = 0;
  let inParityRows = 0;
  const flippedRows: { entity: string; entity_id: string; field: string; inParity: boolean }[] = [];

  for (const r of rows) {
    const computed = normalizeValue(r.app_value) === normalizeValue(r.hs_value);
    totalRows += 1;
    if (computed) inParityRows += 1;

    const fp = perField.get(r.field) ?? { total: 0, inParity: 0, expected: r.expected_unreliable };
    fp.total += 1;
    if (computed) fp.inParity += 1;
    perField.set(r.field, fp);

    const recKey = `${r.entity}:${r.entity_id}`;
    perRecord.set(recKey, (perRecord.get(recKey) ?? true) && computed);

    if (computed !== r.in_parity) {
      flippedRows.push({ entity: r.entity, entity_id: r.entity_id, field: r.field, inParity: computed });
    }
  }

  const pct = (num: number, den: number): number =>
    den === 0 ? 100 : Number(((100 * num) / den).toFixed(2));

  const fieldDetail: FieldParity[] = [...perField.entries()]
    .map(([field, f]) => ({
      field,
      total: f.total,
      inParity: f.inParity,
      pct: pct(f.inParity, f.total),
      expectedUnreliable: f.expected,
    }))
    .sort((a, b) => a.pct - b.pct);

  const fields: Record<string, number> = {};
  for (const f of fieldDetail) fields[f.field] = f.pct;

  const records = perRecord.size;
  const recordsInParity = [...perRecord.values()].filter(Boolean).length;

  const result: ParityResult = {
    overallPct: pct(inParityRows, totalRows),
    recordPct: pct(recordsInParity, records),
    totalRows,
    inParityRows,
    records,
    recordsInParity,
    fields,
    fieldDetail,
    flipped: flippedRows.length,
  };

  if (opts.persist) {
    // Write back only the rows whose flag actually changed (idempotent: 0 on reruns),
    // and stamp last_checked_at so field_state reflects this check.
    for (const fr of flippedRows) {
      await sql`
        update field_state
           set in_parity = ${fr.inParity}, last_checked_at = now()
         where entity = ${fr.entity} and entity_id = ${fr.entity_id} and field = ${fr.field}`;
    }
    await sql`
      insert into parity_snapshot (scope, overall_pct, fields)
      values ('overall', ${result.overallPct}, ${sql.json(fields)})`;
  }

  return result;
}

/** Run the parity check and persist (field_state flips + a fresh parity_snapshot row). */
export async function runParityCheck(): Promise<ParityResult> {
  return withoutProgram((sql) => computeParity(sql, { persist: true }));
}

export interface BannerField {
  field: string;
  pct: number;
  expectedUnreliable: boolean;
}

export interface BannerState {
  overallPct: number;
  thresholdPct: number; // e.g. 95
  overallBelow: boolean; // overall under threshold
  below: BannerField[]; // every below-threshold field, worst first
  surprises: string[]; // below-threshold fields that are NOT expected_unreliable — the alarm
  expectedUnreliable: string[]; // below-threshold fields that are known-unreliable
  alarm: boolean; // true iff a surprise (non-expected) field is below threshold
  takenAt: string | null; // when the snapshot the banner is reading was taken
}

interface SnapshotRow {
  overall_pct: string;
  fields: Record<string, number>;
  taken_at: string;
}

/**
 * The banner read path. Uses the latest parity_snapshot (the persisted view the
 * trend chart shares); if none exists yet, computes live. Classifies each
 * below-threshold field against field_authority.expected_unreliable so the UI can
 * render known-unreliable fields calmly (amber) and SURPRISE drops loudly (red).
 */
export async function getBannerState(): Promise<BannerState> {
  const thresholdFrac = parityThreshold();
  const thresholdPct = Number((thresholdFrac * 100).toFixed(2));

  return withoutProgram(async (sql) => {
    const expectedRows = await sql<{ field: string; expected_unreliable: boolean }[]>`
      select field, expected_unreliable from field_authority where entity = 'family'`;
    const expected = new Map(expectedRows.map((r) => [r.field, r.expected_unreliable]));

    const [snap] = await sql<SnapshotRow[]>`
      select overall_pct, fields, taken_at
      from parity_snapshot
      where scope = 'overall'
      order by taken_at desc
      limit 1`;

    let overallPct: number;
    let fields: Record<string, number>;
    let takenAt: string | null;
    if (snap) {
      overallPct = Number(snap.overall_pct);
      fields = snap.fields ?? {};
      takenAt = new Date(snap.taken_at).toISOString();
    } else {
      const live = await computeParity(sql);
      overallPct = live.overallPct;
      fields = live.fields;
      takenAt = null;
    }

    const below: BannerField[] = Object.entries(fields)
      .filter(([, pct]) => pct < thresholdPct)
      .map(([field, pct]) => ({
        field,
        pct: Number(pct),
        // A field with no authority row would be a true surprise — default false.
        expectedUnreliable: expected.get(field) ?? false,
      }))
      .sort((a, b) => a.pct - b.pct);

    const surprises = below.filter((b) => !b.expectedUnreliable).map((b) => b.field);
    const expectedUnreliable = below.filter((b) => b.expectedUnreliable).map((b) => b.field);

    return {
      overallPct,
      thresholdPct,
      overallBelow: overallPct < thresholdPct,
      below,
      surprises,
      expectedUnreliable,
      alarm: surprises.length > 0,
      takenAt,
    };
  });
}
