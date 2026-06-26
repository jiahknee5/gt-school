import crypto from "node:crypto";
import { withoutProgram } from "../../../../lib/db";
import { applyInboundRecord } from "../../../../lib/sync/reconcile";
import { HS_PROP_FOR_FIELD } from "../../../../lib/connectors/hubspot";
import type { SourceRecord } from "../../../../lib/connectors/SourceConnector";

/**
 * POST /api/webhooks/hubspot — inbound HubSpot webhook receiver.
 *
 * Signature: HubSpot's X-HubSpot-Signature-v3 is base64( HMAC-SHA256( method + uri +
 * rawBody + timestamp, clientSecret ) ), with the timestamp in X-HubSpot-Request-
 * Timestamp and a 5-minute freshness window. The verification is BUILT here, but
 * gated behind HUBSPOT_APP_SECRET:
 *
 *   ┌─ HUBSPOT_APP_SECRET set ─→ verify for real; reject (401) bad/expired/forged sigs.
 *   └─ HUBSPOT_APP_SECRET EMPTY → we cannot authenticate the sender, so we FAIL CLOSED
 *      (503, status "pending HUBSPOT_APP_SECRET") rather than apply unverified writes.
 *
 * NOTE (deferred): exercising this against REAL HubSpot deliveries also needs a public
 * HTTPS endpoint + a configured webhook subscription, and the signed `uri` must match
 * HubSpot's target URL byte-for-byte. That live round-trip is out of scope for this
 * task; the HMAC itself is verified here via a self-signed round-trip test.
 *
 * Apply: idempotent on (source='hubspot', eventId) via processed_events, then routes
 * each property change through the SAME field-directional apply as reconcile().
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESHNESS_MS = 5 * 60 * 1000;

/** families field for a HubSpot property name (reverse of HS_PROP_FOR_FIELD). */
const FIELD_FOR_HS_PROP: Record<string, string> = Object.fromEntries(
  Object.entries(HS_PROP_FOR_FIELD).map(([field, prop]) => [prop, field]),
);

/** Build the v3 base64 HMAC signature. Exported so tests can self-sign a request. */
export function signV3(
  method: string,
  uri: string,
  rawBody: string,
  timestamp: string,
  secret: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(method + uri + rawBody + timestamp, "utf8")
    .digest("base64");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export interface VerifyInput {
  method: string;
  uri: string;
  rawBody: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  now?: number;
}
export type VerifyResult =
  | { ok: true }
  | { ok: false; status: number; reason: string };

/** Verify X-HubSpot-Signature-v3. Returns a status the route maps to an HTTP code. */
export function verifyV3(input: VerifyInput): VerifyResult {
  const secret = process.env.HUBSPOT_APP_SECRET;
  if (!secret) {
    return { ok: false, status: 503, reason: "pending HUBSPOT_APP_SECRET" };
  }
  if (!input.signature) return { ok: false, status: 401, reason: "missing signature" };
  if (!input.timestamp) return { ok: false, status: 400, reason: "missing timestamp" };
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, status: 400, reason: "bad timestamp" };
  const now = input.now ?? Date.now();
  if (Math.abs(now - ts) > FRESHNESS_MS) {
    return { ok: false, status: 400, reason: "timestamp outside 5-minute window" };
  }
  const expected = signV3(input.method, input.uri, input.rawBody, input.timestamp, secret);
  if (!timingSafeEqualStr(expected, input.signature)) {
    return { ok: false, status: 401, reason: "signature mismatch" };
  }
  return { ok: true };
}

interface HubspotEvent {
  eventId?: number | string;
  subscriptionType?: string;
  objectId?: number | string;
  propertyName?: string;
  propertyValue?: string;
  occurredAt?: number;
}

export interface WebhookResult {
  ok: boolean;
  received: number;
  processed: number; // newly applied (not duplicates)
  duplicates: number;
  matched: number;
  applied: number; // events that changed a families column
  note?: string;
}

/**
 * Core inbound handler — verification done by the caller. Idempotent per eventId;
 * applies each contact property change through the shared field-directional apply.
 */
export async function applyHubspotEvents(rawBody: string): Promise<WebhookResult> {
  let events: HubspotEvent[];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { ok: false, received: 0, processed: 0, duplicates: 0, matched: 0, applied: 0, note: "invalid JSON body" };
  }

  return withoutProgram(async (sql) => {
    const authority = await sql<{ field: string; direction: string; authority: string }[]>`
      select field, direction, authority from field_authority where entity = 'family'`;
    const authMap = new Map(
      authority.map((r) => [r.field, { direction: r.direction as "hs_to_app" | "app_to_hs" | "bidir_lww", authority: r.authority }]),
    );

    let processed = 0;
    let duplicates = 0;
    let matched = 0;
    let applied = 0;

    for (const ev of events) {
      const type = ev.subscriptionType ?? "";
      if (!type.startsWith("contact")) continue;
      const eventId = ev.eventId == null ? null : String(ev.eventId);
      if (!eventId) continue;

      const claimed = await sql<{ event_id: string }[]>`
        insert into processed_events (source, event_id)
        values ('hubspot', ${eventId})
        on conflict (source, event_id) do nothing
        returning event_id`;
      if (claimed.length === 0) {
        duplicates += 1;
        continue;
      }
      processed += 1;

      const objectId = ev.objectId == null ? null : String(ev.objectId);
      if (!objectId) continue;
      const raw: Record<string, unknown> = {};
      if (ev.propertyName && ev.propertyName in FIELD_FOR_HS_PROP) {
        raw[ev.propertyName] = ev.propertyValue ?? null;
      }
      const rec: SourceRecord = {
        externalId: objectId,
        updatedAt: ev.occurredAt ? new Date(ev.occurredAt).toISOString() : undefined,
        raw,
      };
      const outcome = await applyInboundRecord(sql, rec, authMap);
      if (outcome.matched) matched += 1;
      if (outcome.changedFields.length > 0) applied += 1;

      await sql`update processed_events set result = ${sql.json({ matched: outcome.matched, changed: outcome.changedFields })}
                where source = 'hubspot' and event_id = ${eventId}`;
    }

    return { ok: true, received: events.length, processed, duplicates, matched, applied };
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const uri = `${proto}://${host}${url.pathname}${url.search}`;

  const verdict = verifyV3({
    method: "POST",
    uri,
    rawBody,
    signature: req.headers.get("x-hubspot-signature-v3"),
    timestamp: req.headers.get("x-hubspot-request-timestamp"),
  });
  if (!verdict.ok) {
    return json({ ok: false, error: verdict.reason }, verdict.status);
  }

  let result: WebhookResult;
  try {
    result = await applyHubspotEvents(rawBody);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
  return json(result, 200);
}
