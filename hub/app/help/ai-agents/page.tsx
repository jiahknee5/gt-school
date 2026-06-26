import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  AGENT_ROSTER,
  AI_AGENT_SAMPLE_QUESTIONS,
  runAskTheHub,
  type AskHubAnswer,
} from "@/lib/ai/agents";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask the Hub AI agents - Help",
};

const DEFAULT_QUESTION = "What should leadership focus on in Monday's marketing meeting?";

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
    </section>
  );
}

export default async function AiAgentsHelpPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const session = await getSession();
  const question = (params.q ?? DEFAULT_QUESTION).trim() || DEFAULT_QUESTION;
  const answer = session
    ? await runAskTheHub({
        question,
        role: session.role,
        userTitle: session.title,
      })
    : null;

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-10">
      <Link href="/help" className="mono text-[11px] text-blue hover:underline">
        &lt;- Help
      </Link>

      <p className="mono mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / AI agents
      </p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Ask the Hub
          </h1>
          <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-muted">
            Role-aware operating agents for GT marketing. Answers are read-only, cited, de-identified,
            and grounded in the Hub&apos;s source-of-truth rules before they recommend a business action.
          </p>
        </div>
        <div className="rounded-card border border-hairline bg-surface px-3 py-2">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">Active role</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {session ? `${session.role} - ${session.title}` : "Not signed in"}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-card border border-hairline bg-surface p-4 shadow-sm">
        <form className="flex flex-col gap-3 lg:flex-row">
          <label className="sr-only" htmlFor="q">
            Ask a question
          </label>
          <input
            id="q"
            name="q"
            defaultValue={question}
            maxLength={600}
            className="min-h-11 flex-1 rounded-card border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-label focus:border-gold"
            placeholder="Ask about budget, data confidence, Open Data, GT Challenge, or your next action..."
          />
          <button
            type="submit"
            className="rounded-card bg-ink-cta px-4 py-2 text-[13px] font-semibold text-on-cta transition-colors hover:bg-navy"
          >
            Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {AI_AGENT_SAMPLE_QUESTIONS.map((sample) => (
            <Link
              key={sample}
              href={`/help/ai-agents?q=${encodeURIComponent(sample)}`}
              className="rounded-card border border-hairline bg-canvas px-2.5 py-1.5 text-[11px] text-slate transition-colors hover:border-gold hover:text-gold"
            >
              {sample}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        {answer ? (
          <AnswerPanel answer={answer} />
        ) : (
          <section className="rounded-card border border-red-soft bg-red-soft p-5 text-red">
            <p className="font-semibold">Sign in required</p>
            <p className="mt-1 text-[13px] leading-relaxed">
              Ask-the-Hub is authenticated because answers depend on role scope. Use the login switcher,
              then return here.
            </p>
          </section>
        )}

        <aside className="space-y-3">
          {AGENT_ROSTER.map((agent) => (
            <section key={agent.id} className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
                {agent.businessUser}
              </p>
              <h2 className="mt-1 text-[14px] font-semibold text-ink">{agent.name}</h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{cleanCopy(agent.objective)}</p>
            </section>
          ))}
        </aside>
      </div>

      <section className="mt-6 rounded-card border border-hairline bg-surface p-4 text-[12px] leading-relaxed text-muted">
        <p className="font-semibold text-ink">Guardrails</p>
        <p className="mt-1">
          The agents refuse raw PII, child-level targeting, full Decision Queue access for non-leaders,
          and exact CAC-by-channel while UTM attribution is unreliable. Open Data is decision context only.
        </p>
        <p className="mt-2">
          Related guide:{" "}
          <Link href="/help/ask-the-hub" className="font-semibold text-gold hover:underline">
            Ask-the-Hub workflow
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
