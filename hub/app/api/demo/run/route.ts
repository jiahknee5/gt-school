// POST /api/demo/run — one-click "run the whole pipeline" for the simplified demo page.
// Captures a fresh, qualifying lead (form), then charges the real Stripe TEST deposit and
// propagates it (database + enrollment paid + CRM outbox), exactly as the public funnel
// does. Returns the track key so the client can open /demo?key=… and watch the key chain.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  captureGiftedQuizSubmission,
  coerceGiftedQuizCaptureRequest,
  GiftedQuizCaptureError,
  type GiftedQuizCaptureStore,
} from "@/lib/gt-challenge/capture";
import { DbGiftedQuizCaptureStore } from "@/lib/gt-challenge/store-db";
import { checkoutDepositForFamily } from "@/lib/demo/journey";
import { clientKeyFromRequest, giftedQuizCaptureLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs"; // node:crypto + the postgres pool
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
    // A fresh, qualifying capture with a UNIQUE email so each run is a new, distinct lead.
    const stamp = Date.now();
    const store: GiftedQuizCaptureStore = new DbGiftedQuizCaptureStore();
    const input = coerceGiftedQuizCaptureRequest({
      idempotency_key: crypto.randomUUID(),
      parent_consent: true,
      parent_email: `harper.demo+${stamp}@gtschool.test`,
      parent_phone: "(512) 555-0143",
      zip: "78704",
      child_first_name: "Harper",
      child_grade: "3",
      answers: {
        patternReasoning: 5,
        curiosity: 5,
        selfDirectedProjects: 5,
        focusPersistence: 5,
        readingAboveGrade: true,
        parentObservation: "Self-taught multiplication from a library book over spring break.",
      },
      utm_source: "ad",
      utm_medium: "paid_social",
      utm_campaign: "gifted_quiz_2026",
    });

    const capture = await captureGiftedQuizSubmission(input, store);
    const familyId = capture.lead.id;

    // Real Stripe TEST deposit → recorded payment + enrollment paid + CRM outbox.
    const pay = await checkoutDepositForFamily(familyId);

    return NextResponse.json({ ok: true, key: familyId, intentId: pay.intentId });
  } catch (err) {
    if (err instanceof GiftedQuizCaptureError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Demo run failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
