import { NextResponse } from "next/server";
import {
  captureGiftedQuizSubmission,
  coerceGiftedQuizCaptureRequest,
  GiftedQuizCaptureError,
  InMemoryGiftedQuizCaptureStore,
  toPublicGiftedQuizCaptureResponse,
} from "@/lib/gt-challenge/capture";
import { clientKeyFromRequest, giftedQuizCaptureLimiter } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const captureStore = new InMemoryGiftedQuizCaptureStore();

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
      persistence: "memory-contract",
      dbGap: "Replace the in-memory store with a transactional DB adapter over campaigns, quiz_submissions, families, sync_outbox, and processed_events.",
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
  captureStore.clear();
  giftedQuizCaptureLimiter.reset();
}

