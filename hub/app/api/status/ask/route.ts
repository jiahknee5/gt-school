// Inline "Ask the Hub" for the Status page. Answers IN PLACE (no redirect), grounded
// in the current (or selected-week) Status snapshot + the Hub's source-of-truth helpers.
// Status-specific questions are answered deterministically with the board's real numbers;
// anything else is handed to the full Ask-the-Hub agent (which itself falls back to a
// deterministic cited answer when no LLM key is configured). Read-only, role-aware.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { generate } from "@/lib/seed/generate";
import { getProgramScopeForUser } from "@/lib/program-preference";
import { resolveViewerProgramScope, type ProgramScope } from "@/lib/program-scope";
import { buildStatusBoard } from "@/lib/status/board";
import { loadOrGenerateSnapshot } from "@/lib/status/store";
import { applySnapshotToBoard, statusLlmConfigured } from "@/lib/status/generate";
import { answerStatusQuestion } from "@/lib/status/ask";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { runAskTheHub } from "@/lib/ai/agents";

export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 600;

async function parseBody(req: Request): Promise<{ question: string; week?: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return { question: String(body.question ?? "").trim(), week: body.week ? String(body.week) : undefined };
  }
  const form = await req.formData().catch(() => null);
  if (!form) return { question: "" };
  return { question: String(form.get("question") ?? "").trim(), week: form.get("week") ? String(form.get("week")) : undefined };
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { question, week } = await parseBody(req);

    if (!question) {
      return NextResponse.json({ error: "Provide a question for Ask the Hub." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json(
        { error: `Question must be ${MAX_QUESTION_CHARS} characters or fewer.` },
        { status: 400 },
      );
    }

    const weeks = weekMondays();
    const selectedWeek = week && weeks.includes(week) ? week : defaultReportingWeek();
    const programScope: ProgramScope = resolveViewerProgramScope(
      session.role,
      await getProgramScopeForUser(session.id),
    );

    const ds = generate({ seed: 424242, families: 1200 });
    const board = buildStatusBoard(ds, programScope, selectedWeek);
    const { snapshot, recalled } = await loadOrGenerateSnapshot(board, programScope, {
      generate: { provider: null },
      persistOnGenerate: false,
    });
    applySnapshotToBoard(board, snapshot, { recalled, isCurrent: selectedWeek === defaultReportingWeek() });

    const statusContext = {
      week: selectedWeek,
      headline: board.answer.headline,
      rag: board.answer.rag,
      source: snapshot.source,
      recalled,
    };

    const llmConfigured = statusLlmConfigured();

    // 1) Status-specific, board-grounded answer. This is ALWAYS deterministic by
    //    design — matched status questions are answered from the board's exact
    //    numbers (you want the real figure, not an LLM paraphrase). The note only
    //    flags a MISSING key; with a key set it explains the by-design determinism.
    const direct = answerStatusQuestion(board, question);
    if (direct.matched) {
      return NextResponse.json({
        ok: true,
        question,
        statusContext,
        source: "status-deterministic",
        answer: direct.answer,
        citations: direct.citations,
        actions: direct.actions,
        note: llmConfigured
          ? "Answered directly from the board's real numbers; free-form questions use live LLM synthesis."
          : "Grounded deterministic answer (no LLM key). Set ANTHROPIC_API_KEY + STATUS_GEN_MODEL for free-form synthesis.",
      });
    }

    // 2) Free-form → full Ask-the-Hub agent (RBAC + PII guarded; deterministic w/o key).
    const agent = await runAskTheHub({ question, role: session.role, userTitle: session.title });
    const note =
      agent.mode === "deterministic"
        ? llmConfigured
          ? "Live LLM synthesis was unavailable; answered from grounded data."
          : "Grounded deterministic answer (no LLM key configured). Set ANTHROPIC_API_KEY + ASK_THE_HUB_MODEL for free-form LLM synthesis."
        : undefined;

    return NextResponse.json({
      ok: true,
      question,
      statusContext,
      source: agent.mode === "anthropic" ? "ask-llm" : "ask-deterministic",
      answer: agent.answer,
      citations: agent.citations.map((c) => ({ title: c.title, href: c.href })),
      actions: agent.actions,
      ...(agent.refused ? { refused: agent.refused } : {}),
      note,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
