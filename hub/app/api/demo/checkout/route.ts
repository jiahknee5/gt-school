// POST /api/demo/checkout — the public deposit step of the ad → quiz → Stripe → Hub slice.
// Charges a REAL Stripe test deposit for a quiz lead (by familyId) and propagates it through
// the production payment handler (records payment, flips enrollment paid, enqueues HubSpot).
// Returns the track key so the client can open the live single-record tracker.

import { NextResponse } from "next/server";
import { checkoutDepositForFamily } from "@/lib/demo/journey";
import { clientKeyFromRequest, giftedQuizCaptureLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs"; // needs node:crypto (signed event) + the postgres pool
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  // Public funnel endpoint — throttle before it touches Stripe / the DB.
  const rate = giftedQuizCaptureLimiter.check(clientKeyFromRequest(req));
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please retry shortly." }, { status: 429 });
  }
  if (!process.env.APP_RW_DATABASE_URL) {
    return NextResponse.json(
      { error: "Live checkout needs a provisioned DB (APP_RW_DATABASE_URL)." },
      { status: 503 },
    );
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { familyId?: string };
    const familyId = String(body.familyId ?? "").trim();
    if (!familyId) {
      return NextResponse.json({ error: "familyId is required." }, { status: 400 });
    }
    const result = await checkoutDepositForFamily(familyId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
