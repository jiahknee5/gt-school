import { handleStripeEvent } from "../../../../lib/payments";

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 *
 * Reads the RAW request body (signature verification must run over bytes, not
 * re-serialized JSON), verifies + propagates via handleStripeEvent, and ACKs 200
 * fast. A bad/missing signature returns 400 (Stripe will not retry a 400);
 * an unexpected processing error returns 500 so Stripe redelivers.
 */

export const runtime = "nodejs"; // needs node:crypto + the postgres pool
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let result;
  try {
    result = await handleStripeEvent(rawBody, sig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const signatureFailure =
      /signature|tolerance|missing signature parts/i.test(msg);
    return json({ ok: false, error: msg }, signatureFailure ? 400 : 500);
  }

  return json({ ok: true, ...result }, 200);
}
