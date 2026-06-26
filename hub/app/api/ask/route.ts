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

    return NextResponse.json({
      role: session.role,
      user: { id: session.id, title: session.title },
      ...answer,
      audit: {
        persisted: false,
        traceId: answer.trace.runId,
        reason: "Sanitized run trace is returned with node/eval rows; durable DB audit is the next hardening step.",
        redactionsApplied: true,
        writeTargets: [],
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
