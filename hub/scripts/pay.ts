import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { loadEnvLocal } from "./_env";
import { withProgram, withoutProgram, closeDb } from "../lib/db";
import {
  createPaymentIntent,
  handleStripeEvent,
  signPayload,
  type StripeEvent,
} from "../lib/payments";

loadEnvLocal();

/**
 * pay.ts — drive a REAL Stripe test-mode payment end-to-end through the hub.
 *
 * Because there is no public webhook URL in dev, we create + confirm a real test
 * PaymentIntent (stamping metadata.program_id/family_id/enrollment_id), then build
 * a signed synthetic webhook event around the returned PI and feed it to the SAME
 * handler the route uses — either via the local route (--http) or directly.
 *
 * It works on a dedicated R-test enrollment under summer_camp (NOT a seeded row),
 * and cleans it up afterward unless --keep is passed.
 *
 * Run: esbuild scripts/pay.ts --bundle --platform=node --format=esm --packages=external \
 *        --outfile=.seed-build/pay.mjs && node .seed-build/pay.mjs [--decline] [--http] [--keep]
 */

const DECLINE = process.argv.includes("--decline");
const HTTP = process.argv.includes("--http");
const KEEP = process.argv.includes("--keep");
const TAG = `Rpay_${randomBytes(3).toString("hex")}`;
const PI_FALLBACK = `pi_${TAG}`; // used only for the --decline synthetic path

async function main(): Promise<void> {
  const programs = await withoutProgram(
    (sql) => sql<{ id: string; key: string }[]>`select id, key from programs`,
  );
  const summer = programs.find((p) => p.key === "summer_camp");
  const fall = programs.find((p) => p.key === "fall_enrollment");
  if (!summer || !fall) throw new Error("programs summer_camp/fall_enrollment missing");

  // ---- create an R-test family + summer enrollment (unpaid) ----
  const familyId = await withoutProgram(async (sql) => {
    const [f] = await sql<{ id: string }[]>`
      insert into families (email, first_name, last_name, match_key)
      values (${`${TAG}@gtfamilies.test`}, 'PayTest', ${TAG}, ${`Rtest:${TAG}`})
      returning id`;
    return f.id;
  });
  const dealId = `deal-${TAG}`;
  const enrollmentId = await withProgram(summer.id, async (sql) => {
    const [e] = await sql<{ id: string }[]>`
      insert into enrollments
        (program_id, family_id, hubspot_deal_id, stage, amount, paid)
      values (${summer.id}, ${familyId}, ${dealId}, 'registered', 725, false)
      returning id`;
    return e.id;
  });
  console.log(`setup: family ${familyId}, summer enrollment ${enrollmentId} (paid=false), deal ${dealId}`);

  const metadata = {
    program_id: summer.id,
    family_id: familyId,
    enrollment_id: enrollmentId,
    program: "summer_camp",
  };

  try {
    let event: StripeEvent;

    if (DECLINE) {
      // The declined card makes Stripe throw; synthesize a payment_failed event so we
      // still exercise the non-terminal failed path against the live DB.
      try {
        await createPaymentIntent({ amount_cents: 72500, metadata, decline: true });
        console.log("unexpected: declined card did NOT throw");
      } catch (e) {
        console.log(`Stripe declined as expected: ${e instanceof Error ? e.message : e}`);
      }
      event = {
        id: `evt_${TAG}_failed`,
        type: "payment_intent.payment_failed",
        created: Math.floor(Date.now() / 1000),
        data: { object: { id: PI_FALLBACK, object: "payment_intent", amount: 72500, status: "requires_payment_method", metadata } },
      };
    } else {
      const pi = await createPaymentIntent({ amount_cents: 72500, metadata });
      console.log(`PaymentIntent ${pi.id} → ${pi.status}`);
      event = {
        id: `evt_${TAG}_succeeded`,
        type: "payment_intent.succeeded",
        created: Math.floor(Date.now() / 1000),
        data: { object: pi as StripeEvent["data"]["object"] },
      };
    }

    const rawBody = JSON.stringify(event);
    const sig = signPayload(rawBody);

    let result: unknown;
    if (HTTP) {
      const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/stripe";
      const res = await fetch(url, {
        method: "POST",
        headers: { "stripe-signature": sig, "content-type": "application/json" },
        body: rawBody,
      });
      result = await res.json();
      console.log(`POST ${url} → ${res.status}`, JSON.stringify(result));
    } else {
      result = await handleStripeEvent(rawBody, sig);
      console.log("handleStripeEvent →", JSON.stringify(result));
    }

    // ---- observe propagation ----
    const summerView = await withProgram(summer.id, async (sql) => {
      const pays = await sql<{ status: string; amount: string }[]>`
        select status, amount from payments where enrollment_id = ${enrollmentId}`;
      const [enr] = await sql<{ paid: boolean; stage: string | null }[]>`
        select paid, stage from enrollments where id = ${enrollmentId}`;
      return { pays, enr };
    });
    const fallView = await withProgram(fall.id, async (sql) => {
      const pays = await sql<{ count: number }[]>`
        select count(*)::int as count from payments where enrollment_id = ${enrollmentId}`;
      return pays[0].count;
    });
    const outbox = await withoutProgram(async (sql) => {
      const rows = await sql<{ op: string; payload: unknown; status: string }[]>`
        select op, payload, status from sync_outbox where aggregate_id = ${enrollmentId}`;
      return rows;
    });

    console.log("---- propagation ----");
    console.log("summer payments:", JSON.stringify(summerView.pays));
    console.log("summer enrollment:", JSON.stringify(summerView.enr));
    console.log("visible under FALL scope (expect 0):", fallView);
    console.log("sync_outbox rows:", JSON.stringify(outbox));
  } finally {
    if (!KEEP) await cleanup(summer.id, familyId, enrollmentId);
    else console.log(`--keep: left family ${familyId} / enrollment ${enrollmentId} in place`);
  }
}

async function cleanup(summerId: string, familyId: string, enrollmentId: string): Promise<void> {
  await withProgram(summerId, async (sql) => {
    await sql`delete from payments where enrollment_id = ${enrollmentId}`;
    await sql`delete from enrollments where id = ${enrollmentId}`;
  });
  await withoutProgram(async (sql) => {
    await sql`delete from sync_outbox where aggregate_id = ${enrollmentId}`;
    await sql`delete from processed_events where source = 'stripe' and event_id like ${`evt_${TAG}_%`}`;
    await sql`delete from families where id = ${familyId}`;
  });
  console.log("cleanup: removed R-test rows.");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error("pay failed:", e);
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
