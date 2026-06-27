import { NextResponse } from "next/server";
import {
  captureGiftedQuizSubmission,
  coerceGiftedQuizCaptureRequest,
  GiftedQuizCaptureError,
  InMemoryGiftedQuizCaptureStore,
  toPublicGiftedQuizCaptureResponse,
  type GiftedQuizCaptureStore,
} from "@/lib/gt-challenge/capture";
import { DbGiftedQuizCaptureStore } from "@/lib/gt-challenge/store-db";
import { clientKeyFromRequest, giftedQuizCaptureLimiter } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// When a DB is configured, capture persists for real (quiz_submissions + families
// + program_membership + a sync_outbox upsert_contact intent that the outbox worker
// dispatches to live HubSpot). Without a DB we fall back to the in-memory contract.
const DB_CONFIGURED = Boolean(process.env.APP_RW_DATABASE_URL);
const captureStore: GiftedQuizCaptureStore = DB_CONFIGURED
  ? new DbGiftedQuizCaptureStore()
  : new InMemoryGiftedQuizCaptureStore();

export async function POST(request: Request): Promise<NextResponse> {
  // This endpoint is PUBLIC (no session). Throttle per client BEFORE doing any work
  // so a flood can't run the grader / outbound sync (security finding S7-c).
  const rate = giftedQuizCaptureLimiter.check(clientKeyFromRequest(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many GT Challenge submissions. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  }

  try {
    const body = await request.json();
    const input = coerceGiftedQuizCaptureRequest(body);
    const result = await captureGiftedQuizSubmission(input, captureStore);

    return NextResponse.json({
      capture: toPublicGiftedQuizCaptureResponse(result),
      persistence: DB_CONFIGURED ? "db" : "memory-contract",
      ...(DB_CONFIGURED
        ? {}
        : {
            dbGap:
              "Replace the in-memory store with a transactional DB adapter over campaigns, quiz_submissions, families, sync_outbox, and processed_events.",
          }),
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (err instanceof GiftedQuizCaptureError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unexpected GT Challenge capture error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function __resetGiftedQuizCaptureStoreForTests(): void {
  captureStore.clear?.();
  giftedQuizCaptureLimiter.reset();
}

