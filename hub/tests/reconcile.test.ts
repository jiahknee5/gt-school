import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../scripts/_env";

loadEnvLocal();

import { closeDb, withoutProgram } from "../lib/db";
import { reconcile } from "../lib/sync/reconcile";
import { archiveContact, createContact, fetchContactsSince } from "../lib/connectors/hubspot";
import { matchKey, type SourceRecord } from "../lib/connectors/SourceConnector";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll the HubSpot search index until the freshly-created contact appears (index
 * lag can be many seconds). Returns the indexed record so the caller can anchor the
 * reconcile watermark to the contact's OWN lastmodifieddate — anchoring to wall-clock
 * "now" is fragile, because a long index lag can push now past the contact's mtime.
 */
async function waitForIndexed(id: string, timeoutMs = 90000): Promise<SourceRecord> {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const recs = await fetchContactsSince(since);
    const hit = recs.find((r) => r.externalId === id);
    if (hit) return hit;
    await sleep(3000);
  }
  throw new Error(`HubSpot did not index contact ${id} within ${timeoutMs}ms`);
}

const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const HAS_HS = Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN?.startsWith("pat-"));
const ENABLED = HAS_DB && HAS_HS;
const T = 90000;
const RUN = `rec${randomBytes(3).toString("hex")}`;
const EMAIL = `gtrecon.${RUN}@example.com`;

let contactId = "";
let familyId = "";
let origCursor: string | null = null;

async function family() {
  return withoutProgram(
    (sql) => sql<{ income_band: string | null; lifecycle_stage: string | null; source: string | null; hubspot_contact_id: string | null }[]>`
      select income_band, lifecycle_stage, source, hubspot_contact_id from families where id = ${familyId}`,
  ).then((r) => r[0]);
}
async function fieldStateInParity(field: string) {
  return withoutProgram(
    (sql) => sql<{ in_parity: boolean; app_value: string | null; hs_value: string | null }[]>`
      select in_parity, app_value, hs_value from field_state where entity='family' and entity_id=${familyId} and field=${field}`,
  ).then((r) => r[0]);
}

describe("reconcile sweep (live HubSpot → app)", () => {
  beforeAll(async () => {
    if (!ENABLED) return;
    // save the demo cursor so we can restore it (keep the seeded state pristine).
    const cur = await withoutProgram(
      (sql) => sql<{ last_synced: string | null }[]>`select last_synced from sync_cursor where key='hubspot:contacts'`,
    );
    origCursor = cur[0]?.last_synced ?? null;

    // A HubSpot contact whose email matches a DB family by match_key. HubSpot is
    // authoritative for lifecycle_stage + source; app is authoritative for income_band.
    const c = await createContact({
      email: EMAIL,
      firstname: "Recon",
      lastname: RUN,
      lifecyclestage: "customer", // hs_to_app: should WIN over the family's 'lead'
      gt_utm_source: "facebook", // hs_to_app: should WIN over the family's 'referral'
      gt_income_band: "under_65k", // app_to_hs: app keeps '65-160K'; parity flagged false
      gt_grade_band: "k_2", // app_to_hs: matches app → in parity
    });
    contactId = c.id;

    familyId = await withoutProgram(async (sql) => {
      const [f] = await sql<{ id: string }[]>`
        insert into families (email, first_name, last_name, match_key,
                              lifecycle_stage, source, income_band, grade)
        values (${EMAIL}, 'Recon', ${RUN}, ${matchKey({ email: EMAIL })},
                'lead', 'referral', '65-160K', 'k_2')
        returning id`;
      return f.id;
    });
  }, T);

  afterAll(async () => {
    if (!ENABLED) {
      if (HAS_DB) await closeDb();
      return;
    }
    await withoutProgram(async (sql) => {
      await sql`delete from field_state where entity='family' and entity_id=${familyId}`;
      await sql`delete from sync_outbox where aggregate_id = ${familyId}`;
      await sql`delete from families where id = ${familyId}`;
      await sql`update sync_cursor set last_synced = ${origCursor} where key='hubspot:contacts'`;
    });
    try {
      await archiveContact(contactId);
    } catch {
      /* best-effort */
    }
    await closeDb();
  }, T);

  it("applies field-directional authority, advances the cursor, and is STABLE across two runs", async () => {
    if (!ENABLED) {
      console.log("SKIP: needs APP_RW_DATABASE_URL + HUBSPOT_PRIVATE_APP_TOKEN");
      return;
    }

    // (0) Full-inventory pull proves fetchSince works at scale — and shows the gap:
    //     the live HubSpot inventory shares no identity with the seeded DB.
    const fullPull = await fetchContactsSince(new Date(0));
    console.log(`full fetchSince(epoch): ${fullPull.length} HubSpot contacts pulled`);
    expect(fullPull.length).toBeGreaterThanOrEqual(100);

    // (1) Wait past HubSpot's search-index lag, then drive the INCREMENTAL path:
    //     anchor the watermark just before the CONTACT's own mtime so the sweep pulls
    //     the recent window (our crafted contact) — not a full epoch backfill, and
    //     robust to however long indexing took.
    const indexed = await waitForIndexed(contactId);
    const contactTs = indexed.updatedAt ? new Date(indexed.updatedAt).getTime() : Date.now();
    await withoutProgram(
      (sql) => sql`update sync_cursor set last_synced = ${new Date(contactTs - 60 * 1000)} where key='hubspot:contacts'`,
    );

    // ---------- RUN A ----------
    const a = await reconcile();
    console.log(
      `reconcile A: fetched=${a.fetched} matched=${a.matched} changed=${a.changed} conflicts=${a.conflicts} ` +
        `parity=${a.parity.overallPct}% cursor ${a.watermarkFrom ?? "null"} → ${a.watermarkTo}`,
    );

    // incremental window pulled at least our crafted contact, which resolved to the
    // family by match_key and linked.
    expect(a.fetched).toBeGreaterThanOrEqual(1);
    expect(a.matched).toBeGreaterThanOrEqual(1);

    const famA = await family();
    expect(famA.hubspot_contact_id).toBe(contactId); // linked via match_key
    expect(famA.lifecycle_stage).toBe("customer"); // hs_to_app applied
    expect(famA.source).toBe("facebook"); // hs_to_app applied
    expect(famA.income_band).toBe("65-160K"); // app_to_hs: NOT overwritten

    const incomeA = await fieldStateInParity("income_band");
    expect(incomeA.in_parity).toBe(false); // disagreement recorded, local preserved
    expect(incomeA.app_value).toBe("65-160K");
    expect(incomeA.hs_value).toBe("under_65k");
    const gradeA = await fieldStateInParity("grade");
    expect(gradeA.in_parity).toBe(true); // app_to_hs but values agree

    // cursor advanced from the (null) demo watermark to a real timestamp.
    expect(a.watermarkTo).toBeTruthy();
    const cursorAfterA = new Date(a.watermarkTo).getTime();
    expect(cursorAfterA).toBeGreaterThan(0);

    // ---------- RUN B ----------
    const b = await reconcile();
    console.log(
      `reconcile B: fetched=${b.fetched} matched=${b.matched} parity=${b.parity.overallPct}% ` +
        `cursor ${b.watermarkFrom ?? "null"} → ${b.watermarkTo}`,
    );

    // parity is STABLE across runs — no echo oscillation on app-authoritative fields.
    expect(b.parity.overallPct).toBe(a.parity.overallPct);

    const famB = await family();
    expect(famB.lifecycle_stage).toBe("customer"); // unchanged
    expect(famB.source).toBe("facebook");
    expect(famB.income_band).toBe("65-160K"); // still not overwritten
    const incomeB = await fieldStateInParity("income_band");
    expect(incomeB.in_parity).toBe(false); // did NOT flip — stable

    // cursor is monotonic (never regresses).
    expect(new Date(b.watermarkTo).getTime()).toBeGreaterThanOrEqual(cursorAfterA);

    // data-population bridge status (honest): the portal can contain seeded bridge
    // contacts plus this crafted contact. The count is diagnostic, not asserted.
    const matchableFull = await withoutProgram(
      (sql) => sql<{ c: number }[]>`
        select count(*)::int as c from families
        where hubspot_contact_id is not null and hubspot_contact_id ~ '^[0-9]+$'`,
    );
    console.log(
      `data-population bridge: ${fullPull.length} HubSpot contacts exist; DB families with a ` +
        `numeric (real) HubSpot id = ${matchableFull[0].c}. The bridge script links a ` +
        `demo-safe subset; unbridged families still carry synthetic 'hs-NNNN' ids.`,
    );
  }, T);
});
