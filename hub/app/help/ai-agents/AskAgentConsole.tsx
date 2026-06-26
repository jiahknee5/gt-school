"use client";

import Link from "next/link";
import { useState } from "react";
import type { AskHubAnswer } from "@/lib/ai/agents";

function cleanCopy(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, " to ")
    .replace(/\u2194/g, " and ")
    .replace(/\u00b7/g, "/");
}

function Tone({ value }: { value: string }) {
  const cls =
    value === "high"
      ? "bg-green-soft text-green"
      : value === "medium"
        ? "bg-amber-soft text-amber"
        : "bg-fill text-slate";
  return (
    <span className={`mono rounded-[6px] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${cls}`}>
      {value}
    </span>
  );
}

function AnswerPanel({ answer }: { answer: AskHubAnswer }) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            {answer.agent.name}
          </p>
          <h2 className="mt-1 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">
            Answer
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tone value={answer.confidence} />
          <span className="mono rounded-[6px] bg-fill px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate">
            {answer.mode}
          </span>
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-muted">{cleanCopy(answer.answer)}</p>

      {answer.refused && (
        <div className="mt-4 rounded-card border border-red-soft bg-red-soft p-3 text-[12px] leading-relaxed text-red">
          <p className="font-semibold">Refused safely</p>
          <p className="mt-1">{cleanCopy(answer.refused.reason)}</p>
          <p className="mt-1 text-ink">{cleanCopy(answer.refused.saferAlternative)}</p>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
            Recommended next actions
          </h3>
          <ul className="mt-2 space-y-2">
            {answer.actions.map((action) => (
              <li key={action} className="rounded-card border border-hairline bg-canvas px-3 py-2 text-[12px] leading-snug text-slate">
                {cleanCopy(action)}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
            Caveats
          </h3>
          <ul className="mt-2 space-y-2">
            {(answer.warnings.length ? answer.warnings : ["No additional caveats for this answer."]).map((warning) => (
              <li key={warning} className="rounded-card border border-hairline bg-canvas px-3 py-2 text-[12px] leading-snug text-slate">
                {cleanCopy(warning)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="mono mt-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
        Evidence and citations
      </h3>
      <div className="mt-2 grid gap-2">
        {answer.citations.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className="rounded-card border border-hairline bg-canvas p-3 text-[12px] transition-colors hover:border-gold"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">{c.title}</p>
              <span className="mono text-[10px] uppercase tracking-[0.08em] text-label">{c.source}</span>
            </div>
            <p className="mt-1 leading-relaxed text-muted">{cleanCopy(c.excerpt)}</p>
          </Link>
        ))}
      </div>

      <div className="mt-5 rounded-card border border-hairline bg-canvas p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
            Run trace
          </p>
          <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">
            {answer.trace.runId}
          </span>
          <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">
            {answer.trace.graph.nodes.length} nodes
          </span>
          <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">
            {answer.evalRows.filter((row) => row.pass).length}/{answer.evalRows.length} eval rows pass
          </span>
        </div>
      </div>
    </section>
  );
}

export function AskAgentConsole({
  defaultQuestion,
  sampleQuestions,
  signedIn,
}: {
  defaultQuestion: string;
  sampleQuestions: string[];
  signedIn: boolean;
}) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [answer, setAnswer] = useState<AskHubAnswer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(nextQuestion = question) {
    const q = nextQuestion.trim();
    if (!q) return;
    setQuestion(q);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Ask-the-Hub failed.");
      setAnswer(body as AskHubAnswer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask-the-Hub failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="mt-6 rounded-card border border-hairline bg-surface p-4 shadow-sm">
        <form
          className="flex flex-col gap-3 lg:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor="ask-question">
            Ask a question
          </label>
          <input
            id="ask-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={600}
            disabled={!signedIn}
            className="min-h-11 flex-1 rounded-card border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-label focus:border-gold disabled:opacity-60"
            placeholder="Ask about budget, data confidence, Open Data, GT Challenge, or your next action..."
          />
          <button
            type="submit"
            disabled={!signedIn || loading}
            className="rounded-card bg-ink-cta px-4 py-2 text-[13px] font-semibold text-on-cta transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Asking..." : "Ask"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {sampleQuestions.map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={!signedIn || loading}
              onClick={() => void ask(sample)}
              className="rounded-card border border-hairline bg-canvas px-2.5 py-1.5 text-[11px] text-slate transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sample}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 rounded-card border border-red-soft bg-red-soft p-3 text-[12px] text-red">{error}</p>}
      </section>

      <div className="mt-6">
        {answer ? (
          <AnswerPanel answer={answer} />
        ) : signedIn ? (
          <section className="rounded-card border border-hairline bg-surface p-5 text-[13px] leading-relaxed text-muted">
            Ask a role-aware operating question to run the agent graph. The request is sent by POST, not stored in the URL.
          </section>
        ) : (
          <section className="rounded-card border border-red-soft bg-red-soft p-5 text-red">
            <p className="font-semibold">Sign in required</p>
            <p className="mt-1 text-[13px] leading-relaxed">
              Ask-the-Hub is authenticated because answers depend on role scope. Use the login switcher, then return here.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
