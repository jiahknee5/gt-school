// POST /api/demo/run — one-click "run the whole pipeline" for the simplified demo page.
// HubSpot-FIRST (Johnny's chosen demo architecture): the CRM contact + deal are created
// first, then mirrored to the DB, then the real Stripe TEST deposit is charged. Returns
// the track key + the HubSpot ids/URLs so /demo?key=… renders the chain and links out.

import { NextResponse } from "next/server";
import { GiftedQuizCaptureError } from "@/lib/gt-challenge/capture";
import { runHubspotFirstDemo } from "@/lib/demo/journey";
import { clientKeyFromRequest, giftedQuizCaptureLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs"; // node:crypto + the postgres pool + HubSpot fetch
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const rate = giftedQuizCaptureLimiter.check(clientKeyFromRequest(req));
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please retry shortly." }, { status: 429 });
  }
  if (!process.env.APP_RW_DATABASE_URL) {
    return NextResponse.json(
      { error: "The live demo needs a provisioned DB (APP_RW_DATABASE_URL)." },
      { status: 503 },
    );
  }

  try {
    const result = await runHubspotFirstDemo();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GiftedQuizCaptureError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Demo run failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
