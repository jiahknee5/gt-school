// Ask-the-Hub API. Read-only, role-aware business assistant over the Hub's
// canonical source-of-truth helpers. It never accepts role/program scope from the
// client and does not expose raw CRM/family/child rows.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import {
  AGENT_ROSTER,
  AI_AGENT_QUESTION_TYPES,
  AI_AGENT_SAMPLE_QUESTIONS,
  runAskTheHub,
} from "@/lib/ai/agents";
import { persistTrace, toStoredTrace } from "@/lib/ai/trace-store";

export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 600;

async function parseQuestion(req: Request): Promise<string> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return String(body.question ?? "").trim();
  }
  const form = await req.formData().catch(() => null);
  if (!form) return "";
  return String(form.get("question") ?? "").trim();
}

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({
      role: session.role,
      user: { id: session.id, title: session.title },
      agents: AGENT_ROSTER,
      questionTypes: AI_AGENT_QUESTION_TYPES,
      sampleQuestions: AI_AGENT_SAMPLE_QUESTIONS,
      policy: {
        readOnly: true,
        deidentified: true,
        sourceGrounded: true,
        operatorFullQueueAccess: false,
        providerBackedWhenConfigured: Boolean(process.env.ANTHROPIC_API_KEY && process.env.ASK_THE_HUB_MODEL),
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const question = await parseQuestion(req);

    if (!question) {
      return NextResponse.json({ error: "Provide a question for Ask-the-Hub." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json(
        { error: `Question must be ${MAX_QUESTION_CHARS} characters or fewer.` },
        { status: 400 },
      );
    }

    const answer = await runAskTheHub({
      question,
      role: session.role,
      userTitle: session.title,
    });

    // Durably persist the SANITIZED run trace (node/eval rows — never raw CRM rows) so it
    // can be audited later. DB when APP_RW_DATABASE_URL is set, else a file store.
    const persist = await persistTrace(toStoredTrace(answer.trace, "ask-the-hub", session.role));

    return NextResponse.json({
      role: session.role,
      user: { id: session.id, title: session.title },
      ...answer,
      audit: {
        persisted: persist.persisted,
        storeKind: persist.storeKind,
        traceId: answer.trace.runId,
        reason: persist.persisted
          ? `Sanitized run trace persisted to the ${persist.storeKind} store for audit.`
          : "Trace persistence unavailable; sanitized trace returned inline only.",
        redactionsApplied: true,
        writeTargets: persist.writeTargets,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
