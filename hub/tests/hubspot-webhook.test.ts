import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../scripts/_env";

loadEnvLocal();

import { closeDb, withoutProgram } from "../lib/db";
import {
  applyHubspotEvents,
  POST,
  signV3,
  verifyV3,
} from "../app/api/webhooks/hubspot/route";

const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const HAS_SECRET = Boolean(process.env.HUBSPOT_APP_SECRET);
const T = 20000;
const RUN = `wh${randomBytes(3).toString("hex")}`;
const HSID = `whk-${RUN}`; // the family's HubSpot id; the event objectId matches it

let familyId = "";

interface HsEvt {
  eventId: string;
  subscriptionType: string;
  objectId: string;
  propertyName: string;
  propertyValue: string;
  occurredAt: number;
}
function evt(propertyName: string, propertyValue: string, suffix: string): HsEvt {
  return {
    eventId: `${RUN}-${suffix}`,
    subscriptionType: "contact.propertyChange",
    objectId: HSID,
    propertyName,
    propertyValue,
    occurredAt: Date.now(),
  };
}

describe("inbound HubSpot webhook (X-HubSpot-Signature-v3 + field-directional apply)", () => {
  beforeAll(async () => {
    if (!HAS_DB) return;
    familyId = await withoutProgram(async (sql) => {
      const [f] = await sql<{ id: string }[]>`
        insert into families (email, first_name, last_name, hubspot_contact_id,
                              lifecycle_stage, income_band)
        values (${`${RUN}@gtfamilies.test`}, 'Webhook', ${RUN}, ${HSID}, 'lead', '65-160K')
        returning id`;
      return f.id;
    });
  }, T);

  afterAll(async () => {
    if (!HAS_DB) return;
    await withoutProgram(async (sql) => {
      await sql`delete from field_state where entity='family' and entity_id=${familyId}`;
      await sql`delete from processed_events where source='hubspot' and event_id like ${`${RUN}-%`}`;
      await sql`delete from processed_events where source='hubspot' and event_id like ${`${RUN}post%`}`;
      await sql`delete from families where id = ${familyId}`;
    });
    await closeDb();
  }, T);

  // ----------------------------- signature (no DB) -----------------------------

  it("verifies a correctly-signed v3 request and rejects tamper/expiry/missing", () => {
    if (!HAS_SECRET) {
      console.log("SKIP sig: HUBSPOT_APP_SECRET empty");
      return;
    }
    const secret = process.env.HUBSPOT_APP_SECRET!;
    const uri = "https://hub.example.com/api/webhooks/hubspot";
    const body = JSON.stringify([evt("lifecyclestage", "customer", "sig")]);
    const ts = String(Date.now());
    const sig = signV3("POST", uri, body, ts, secret);

    expect(verifyV3({ method: "POST", uri, rawBody: body, signature: sig, timestamp: ts }).ok).toBe(true);
    // tampered body → mismatch
    const bad = verifyV3({ method: "POST", uri, rawBody: body + " ", signature: sig, timestamp: ts });
    expect(bad).toEqual({ ok: false, status: 401, reason: "signature mismatch" });
    // missing signature → 401
    expect(verifyV3({ method: "POST", uri, rawBody: body, signature: null, timestamp: ts }).ok).toBe(false);
    // expired timestamp → 400
    const old = String(Date.now() - 10 * 60 * 1000);
    const oldSig = signV3("POST", uri, body, old, secret);
    const exp = verifyV3({ method: "POST", uri, rawBody: body, signature: oldSig, timestamp: old });
    expect(exp).toEqual({ ok: false, status: 400, reason: "timestamp outside 5-minute window" });
  });

  it("fails CLOSED (503 pending) when HUBSPOT_APP_SECRET is empty", () => {
    const saved = process.env.HUBSPOT_APP_SECRET;
    delete process.env.HUBSPOT_APP_SECRET;
    try {
      const v = verifyV3({ method: "POST", uri: "https://x/y", rawBody: "[]", signature: "abc", timestamp: String(Date.now()) });
      expect(v).toEqual({ ok: false, status: 503, reason: "pending HUBSPOT_APP_SECRET" });
    } finally {
      if (saved !== undefined) process.env.HUBSPOT_APP_SECRET = saved;
    }
  });

  // -------------------------- apply + idempotency (DB) --------------------------

  it("applies events through the SAME field-directional authority as reconcile, idempotently", async () => {
    if (!HAS_DB) {
      console.log("SKIP apply: APP_RW_DATABASE_URL not set");
      return;
    }
    const body = JSON.stringify([
      evt("lifecyclestage", "customer", "lc"), // hs_to_app → should WIN
      evt("gt_income_band", "under_65k", "inc"), // app_to_hs → must NOT overwrite
    ]);

    const first = await applyHubspotEvents(body);
    console.log(`apply #1: received=${first.received} processed=${first.processed} matched=${first.matched} applied=${first.applied} dup=${first.duplicates}`);
    expect(first.processed).toBe(2);
    expect(first.matched).toBe(2);
    expect(first.applied).toBe(1); // only lifecycle changed a families column

    const fam = await withoutProgram(
      (sql) => sql<{ lifecycle_stage: string | null; income_band: string | null }[]>`
        select lifecycle_stage, income_band from families where id=${familyId}`,
    );
    expect(fam[0].lifecycle_stage).toBe("customer"); // hs_to_app applied
    expect(fam[0].income_band).toBe("65-160K"); // app_to_hs NOT overwritten

    const incomeFs = await withoutProgram(
      (sql) => sql<{ in_parity: boolean; hs_value: string | null }[]>`
        select in_parity, hs_value from field_state where entity='family' and entity_id=${familyId} and field='income_band'`,
    );
    expect(incomeFs[0].in_parity).toBe(false);
    expect(incomeFs[0].hs_value).toBe("under_65k");

    // replay the exact same batch → all duplicates, no re-apply.
    const second = await applyHubspotEvents(body);
    console.log(`apply #2 (replay): processed=${second.processed} dup=${second.duplicates}`);
    expect(second.processed).toBe(0);
    expect(second.duplicates).toBe(2);
  }, T);

  it("POST route: 200 on a correctly-signed request, 401 on a tampered body", async () => {
    if (!HAS_DB || !HAS_SECRET) {
      console.log("SKIP route: needs DB + HUBSPOT_APP_SECRET");
      return;
    }
    const secret = process.env.HUBSPOT_APP_SECRET!;
    const url = "https://local/api/webhooks/hubspot"; // proto defaults to https, host=local
    const body = JSON.stringify([
      { eventId: `${RUN}post1`, subscriptionType: "contact.propertyChange", objectId: "no-such-id", propertyName: "lifecyclestage", propertyValue: "customer", occurredAt: Date.now() },
    ]);
    const ts = String(Date.now());
    const sig = signV3("POST", url, body, ts, secret);

    const mkReq = (b: string) =>
      new Request(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hubspot-signature-v3": sig,
          "x-hubspot-request-timestamp": ts,
        },
        body: b,
      });

    const okRes = await POST(mkReq(body));
    const okBody = (await okRes.json()) as Record<string, unknown>;
    console.log(`POST ok: status=${okRes.status} body=${JSON.stringify(okBody)}`);
    expect(okRes.status).toBe(200);
    expect(okBody.ok).toBe(true);
    expect(okBody.matched).toBe(0); // objectId matches no family — apply mechanics still run

    // tampered body no longer matches the signature → 401, no apply.
    const badRes = await POST(mkReq(body + " "));
    expect(badRes.status).toBe(401);
  }, T);
});
