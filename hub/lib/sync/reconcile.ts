import { withoutProgram, type ScopedSql } from "../db";
import {
  hubspotConnector,
  HS_PROP_FOR_FIELD,
} from "../connectors/hubspot";
import {
  matchKey,
  type SourceConnector,
  type SourceRecord,
} from "../connectors/SourceConnector";
import { computeParity, normalizeValue, type ParityResult } from "../parity";

/**
 * reconcile.ts — the inbound reconciliation sweep (HubSpot → app), plus the
 * field-directional APPLY that the inbound webhook route reuses.
 *
 * reconcile():
 *   1. Reads the sync_cursor watermark and fetches HubSpot contacts modified since
 *      (watermark − Δ). The overlap Δ re-scans a small window to cover HubSpot's
 *      modified-since index lag (records can surface slightly out of order).
 *   2. Resolves each record to a family (by hubspot_contact_id, else by match_key),
 *      then applies it per field_authority DIRECTION:
 *        - hs_to_app   → HubSpot wins: update families + field_state, in parity.
 *        - app_to_hs   → app wins: NEVER overwrite local; record HubSpot's value and
 *                        flag field_state.in_parity = (norm(app) == norm(hs)).
 *        - bidir_lww   → last-writer-wins by value, with ECHO-SUPPRESSION.
 *   3. Advances the cursor (monotonically) and recomputes parity (writes a snapshot).
 *
 * ECHO-SUPPRESSION: a HubSpot value that merely reflects our own recent outbound
 * write (recorded in sync_outbox) must not be re-ingested as an external change —
 * otherwise an app↔HubSpot pair can oscillate. We compare the inbound value against
 * the value we last pushed; if it matches, we keep the local value authoritative and
 * do not let it flip state. Combined with "never overwrite local for app_to_hs," this
 * makes parity STABLE across repeated reconciles when nothing actually changed.
 */

const DEFAULT_OVERLAP_SEC = 120;

type Direction = "hs_to_app" | "app_to_hs" | "bidir_lww";

interface AuthorityEntry {
  direction: Direction;
  authority: string;
}
type AuthorityMap = Map<string, AuthorityEntry>;

// families columns the apply can touch (those mapped to a HubSpot property).
const APPLY_FIELDS = Object.keys(HS_PROP_FOR_FIELD);

interface FamilyRow {
  id: string;
  hubspot_contact_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  funnel_stage: string | null;
  tefa_status: string | null;
  income_band: string | null;
  grade: string | null;
  lifecycle_stage: string | null;
  lead_score: number | null;
  source: string | null;
}

export interface ApplyOutcome {
  matched: boolean;
  familyId?: string;
  resolvedBy?: "hubspot_id" | "match_key";
  changedFields: string[]; // families columns HubSpot won
  conflicts: string[]; // app_to_hs / bidir fields where HubSpot disagrees with local
  echoes: string[]; // fields where HubSpot merely echoed our own outbound write
}

const familyColumnValue = (fam: FamilyRow, field: string): string | null => {
  const v = (fam as unknown as Record<string, unknown>)[field];
  return v == null ? null : String(v);
};

/** What we last pushed outbound per field, from the durable outbox (echo-suppression input). */
async function lastOutboundValues(
  sql: ScopedSql,
  aggregateId: string,
): Promise<Map<string, string>> {
  const rows = await sql<{ payload: Record<string, unknown> }[]>`
    select payload from sync_outbox
    where aggregate_id = ${aggregateId} and target_system = 'hubspot'
    order by created_at desc
    limit 25`;
  const last = new Map<string, string>();
  for (const r of rows) {
    const p = r.payload ?? {};
    // payloads carry field values either flat ({funnel_stage:…}) or under properties.
    const flat = { ...(p as Record<string, unknown>), ...((p as { properties?: Record<string, unknown> }).properties ?? {}) };
    for (const f of APPLY_FIELDS) {
      if (!last.has(f) && flat[f] != null) last.set(f, String(flat[f]));
    }
  }
  return last;
}

async function upsertFieldState(
  sql: ScopedSql,
  familyId: string,
  field: string,
  appVal: string | null,
  hsVal: string | null,
  inParity: boolean,
  hsUpdatedAt: Date,
): Promise<void> {
  await sql`
    insert into field_state
      (entity, entity_id, field, app_value, hs_value, app_updated_at, hs_updated_at, in_parity, last_checked_at)
    values
      ('family', ${familyId}, ${field}, ${appVal}, ${hsVal}, now(), ${hsUpdatedAt}, ${inParity}, now())
    on conflict (entity, entity_id, field) do update set
      app_value     = excluded.app_value,
      hs_value      = excluded.hs_value,
      hs_updated_at = excluded.hs_updated_at,
      in_parity     = excluded.in_parity,
      last_checked_at = excluded.last_checked_at`;
}

/**
 * Apply ONE inbound HubSpot record to the backbone per field_authority direction.
 * Shared by reconcile() and the inbound webhook route. Pure DB writes; no HTTP.
 */
export async function applyInboundRecord(
  sql: ScopedSql,
  rec: SourceRecord,
  authority: AuthorityMap,
): Promise<ApplyOutcome> {
  // ---- identity resolution: HubSpot id first, then the match_key ----
  let fam: FamilyRow | undefined;
  let resolvedBy: "hubspot_id" | "match_key" | undefined;

  const byId = await sql<FamilyRow[]>`
    select id, hubspot_contact_id, email, phone, first_name, last_name,
           funnel_stage, tefa_status, income_band, grade, lifecycle_stage, lead_score, source
    from families where hubspot_contact_id = ${rec.externalId} limit 1`;
  if (byId[0]) {
    fam = byId[0];
    resolvedBy = "hubspot_id";
  } else {
    const mk = matchKey({
      email: rec.email,
      phone: rec.phone,
      firstName: rec.firstName,
      lastName: rec.lastName,
      zip: rec.zip,
    });
    if (mk) {
      const byKey = await sql<FamilyRow[]>`
        select id, hubspot_contact_id, email, phone, first_name, last_name,
               funnel_stage, tefa_status, income_band, grade, lifecycle_stage, lead_score, source
        from families where match_key = ${mk} order by created_at asc limit 1`;
      if (byKey[0]) {
        fam = byKey[0];
        resolvedBy = "match_key";
      }
    }
  }

  if (!fam) {
    return { matched: false, changedFields: [], conflicts: [], echoes: [] };
  }

  const raw = rec.raw ?? {};
  const hsUpdatedAt = rec.updatedAt ? new Date(rec.updatedAt) : new Date();
  const lastPushed = await lastOutboundValues(sql, fam.id);

  const changedFields: string[] = [];
  const conflicts: string[] = [];
  const echoes: string[] = [];
  const familyUpdates: Record<string, string | null> = {};

  for (const field of APPLY_FIELDS) {
    const auth = authority.get(field);
    if (!auth) continue;
    const hsProp = HS_PROP_FOR_FIELD[field];
    if (!(hsProp in raw)) continue; // HubSpot didn't return this property

    const rawHs = raw[hsProp];
    const hsVal = rawHs == null || String(rawHs) === "" ? null : String(rawHs);
    const appVal = familyColumnValue(fam, field);
    const nApp = normalizeValue(appVal);
    const nHs = normalizeValue(hsVal);
    const pushed = lastPushed.get(field);
    const isEcho = pushed != null && normalizeValue(pushed) === nHs;
    if (isEcho) echoes.push(field);

    if (auth.direction === "hs_to_app") {
      // HubSpot authoritative. Apply unless already equal (idempotent).
      if (nApp !== nHs && hsVal !== null) {
        familyUpdates[field] = hsVal;
        changedFields.push(field);
        await upsertFieldState(sql, fam.id, field, hsVal, hsVal, true, hsUpdatedAt);
      } else {
        await upsertFieldState(sql, fam.id, field, appVal, hsVal, nApp === nHs, hsUpdatedAt);
      }
    } else if (auth.direction === "app_to_hs") {
      // App authoritative. NEVER overwrite local; record HubSpot's value + parity flag.
      const inParity = nApp === nHs;
      await upsertFieldState(sql, fam.id, field, appVal, hsVal, inParity, hsUpdatedAt);
      if (!inParity) conflicts.push(field);
    } else {
      // bidir_lww — last-writer-wins by value, with echo-suppression.
      let inParity = nApp === nHs;
      if (!inParity && !isEcho && nApp === null && hsVal !== null) {
        // our side is empty and this is NOT our own echo → gap-fill from HubSpot.
        familyUpdates[field] = hsVal;
        changedFields.push(field);
        inParity = true;
        await upsertFieldState(sql, fam.id, field, hsVal, hsVal, true, hsUpdatedAt);
      } else {
        // keep local (non-empty, or an echo of our own write) — no oscillation.
        await upsertFieldState(sql, fam.id, field, appVal, hsVal, inParity, hsUpdatedAt);
        if (!inParity) conflicts.push(field);
      }
    }
  }

  // Link the HubSpot id if we matched by key, and stamp sync bookkeeping.
  if (fam.hubspot_contact_id == null) familyUpdates.hubspot_contact_id = rec.externalId;

  if (Object.keys(familyUpdates).length > 0) {
    await sql`
      update families set ${sql(familyUpdates)},
        hs_updated_at = ${hsUpdatedAt},
        last_synced_at = now()
      where id = ${fam.id}`;
  } else {
    await sql`update families set last_synced_at = now() where id = ${fam.id}`;
  }

  return { matched: true, familyId: fam.id, resolvedBy, changedFields, conflicts, echoes };
}

export interface ReconcileResult {
  fetched: number;
  matched: number;
  changed: number; // records that resulted in ≥1 families column change
  conflicts: number; // total app-authoritative disagreements recorded
  echoes: number;
  since: string;
  watermarkFrom: string | null;
  watermarkTo: string;
  parity: ParityResult;
}

async function loadAuthority(sql: ScopedSql): Promise<AuthorityMap> {
  const rows = await sql<{ field: string; direction: Direction; authority: string }[]>`
    select field, direction, authority from field_authority where entity = 'family'`;
  return new Map(rows.map((r) => [r.field, { direction: r.direction, authority: r.authority }]));
}

export interface ReconcileOptions {
  overlapSec?: number; // Δ subtracted from the watermark (default 120s)
  connector?: SourceConnector; // default live HubSpot
  cursorKey?: string; // default 'hubspot:contacts'
}

export async function reconcile(opts: ReconcileOptions = {}): Promise<ReconcileResult> {
  const overlapSec = opts.overlapSec ?? DEFAULT_OVERLAP_SEC;
  const connector = opts.connector ?? hubspotConnector();
  const cursorKey = opts.cursorKey ?? "hubspot:contacts";

  return withoutProgram(async (sql) => {
    const runStart = new Date();
    const [cur] = await sql<{ last_synced: string | null }[]>`
      select last_synced from sync_cursor where key = ${cursorKey}`;
    const watermark = cur?.last_synced ? new Date(cur.last_synced) : new Date(0);
    const since = new Date(watermark.getTime() - overlapSec * 1000);

    const records = await connector.fetchSince(since);
    const authority = await loadAuthority(sql);

    let matched = 0;
    let changed = 0;
    let conflicts = 0;
    let echoes = 0;
    let maxModifiedMs = 0;
    for (const rec of records) {
      const out = await applyInboundRecord(sql, rec, authority);
      if (out.matched) matched += 1;
      if (out.changedFields.length > 0) changed += 1;
      conflicts += out.conflicts.length;
      echoes += out.echoes.length;
      if (rec.updatedAt) maxModifiedMs = Math.max(maxModifiedMs, new Date(rec.updatedAt).getTime());
    }

    // Advance the cursor monotonically: to the newest record seen, else to run start,
    // but never backwards.
    const candidateMs = records.length > 0 ? maxModifiedMs : runStart.getTime();
    const newWatermarkMs = Math.max(watermark.getTime(), candidateMs);
    const newWatermark = new Date(newWatermarkMs);
    await sql`
      update sync_cursor set last_synced = ${newWatermark}, updated_at = now()
      where key = ${cursorKey}`;

    const parity = await computeParity(sql, { persist: true });

    return {
      fetched: records.length,
      matched,
      changed,
      conflicts,
      echoes,
      since: since.toISOString(),
      watermarkFrom: cur?.last_synced ? new Date(cur.last_synced).toISOString() : null,
      watermarkTo: newWatermark.toISOString(),
      parity,
    };
  });
}
