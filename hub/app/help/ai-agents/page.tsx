import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  AGENT_ROSTER,
  AI_AGENT_QUESTION_TYPES,
  AI_AGENT_SAMPLE_QUESTIONS,
} from "@/lib/ai/agents";
import { AskAgentConsole } from "./AskAgentConsole";

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

export default async function AiAgentsHelpPage() {
  const session = await getSession();

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

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <AskAgentConsole
            defaultQuestion={DEFAULT_QUESTION}
            sampleQuestions={AI_AGENT_SAMPLE_QUESTIONS}
            signedIn={Boolean(session)}
          />
        </div>

        <aside className="mt-6 space-y-3">
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

      <section className="mt-6 rounded-card border border-hairline bg-surface p-4 shadow-sm">
        <p className="font-semibold text-ink">Question types</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {AI_AGENT_QUESTION_TYPES.map((group) => (
            <div key={group.title} className="rounded-card border border-hairline bg-canvas p-3">
              <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">{group.role}</p>
              <h2 className="mt-1 text-[13px] font-semibold text-ink">{group.title}</h2>
              <ul className="mt-2 space-y-1">
                {group.questions.map((question) => (
                  <li key={question} className="text-[11px] leading-snug text-muted">{cleanCopy(question)}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-snug text-slate">{cleanCopy(group.outcome)}</p>
            </div>
          ))}
        </div>
      </section>

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
