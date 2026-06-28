import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import { ASK_EVAL_CASES, runAskEvalSuite } from "@/lib/ai/agents";
import { statusGenCallSite } from "@/lib/ai/observability";
import { listRecentTraces } from "@/lib/ai/trace-store";
import { loadDataset } from "@/lib/seed/load-dataset";
import { AgentGraphConsole } from "./AgentGraphConsole";
import { AgentGraphDiagram } from "./AgentGraphDiagram";

export const dynamic = "force-dynamic";

function Status({ pass }: { pass: boolean }) {
  return (
    <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${pass ? "bg-green-soft text-green" : "bg-red-soft text-red"}`}>
      {pass ? "pass" : "fail"}
    </span>
  );
}

export default async function DevAgentsPage() {
  const suite = await runAskEvalSuite();
  const first = suite.results[0];
  // WS6 — every LLM call-site in one place, same eval shape. Ask-the-Hub (above) +
  // Status generation, plus the durably-persisted run traces.
  const statusSite = statusGenCallSite(await loadDataset({ seed: 424242, families: 1200 }));
  const recentTraces = await listRecentTraces(10);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Agents
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Ask-the-Hub agent graph
      </h1>
      <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
        Live agent runs expose the same trace shape the API returns: node, input, expected output,
        actual output, pass/fail, citations, and decisions. The built-in suite below runs in deterministic
        mode so regressions are reproducible without model or network access.
      </p>

      <DevTabs />

      {first && (
        <section className="mt-4 rounded-card border border-hairline bg-side/40 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">Agent graph — run pipeline</h2>
            <p className="mono text-[10px] text-label">
              {first.answer.trace.graph.nodes.length} nodes ·{" "}
              {first.answer.trace.graph.edges.length} edges · case <span className="text-slate">{first.case.id}</span>
            </p>
          </div>
          <AgentGraphDiagram nodes={first.answer.trace.graph.nodes} edges={first.answer.trace.graph.edges} />
          <p className="mono mt-3 text-center text-[9px] text-label">
            ● green = passed · red = failed · amber = warned — hover a node for its input → output. Run your own above.
          </p>
        </section>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Cases", `${suite.total}`],
          ["Passed", `${suite.passed}`],
          ["Failed", `${suite.failed}`],
          ["Provider", "deterministic"],
          ["Nodes/case", `${first?.answer.trace.graph.nodes.length ?? 0}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <section className="mt-5">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
          Eval cases
        </p>
        <div className="mt-2 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
          {suite.results.map((result) => (
            <div key={result.case.id} className="border-b border-hairline px-3 py-2.5 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <code className="mono text-[11px] font-semibold text-slate">{result.case.id}</code>
                <Status pass={result.pass} />
                <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{result.case.role}</span>
                <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{result.answer.agent.id}</span>
              </div>
              <p className="mt-1 text-[12px] font-semibold text-ink">{result.case.question}</p>
              {result.failures.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px] text-red">
                  {result.failures.map((failure) => <li key={failure}>{failure}</li>)}
                </ul>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {result.answer.citations.map((c) => (
                  <Link key={c.id} href={c.href} className="mono rounded-[5px] bg-canvas px-1.5 py-0.5 text-[9px] text-slate hover:text-gold">
                    {c.id}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
          Node rows
        </p>
        <div className="mt-2 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline bg-side">
                {["Case", "Node", "Pass", "Input", "Expected out", "Actual out", "Citations"].map((h) => (
                  <th key={h} className="mono px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-label">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suite.results.flatMap((result) =>
                result.answer.evalRows.map((row) => (
                  <tr key={`${result.case.id}:${row.node}`} className="border-b border-hairline last:border-0 align-top">
                    <td className="mono px-2 py-1 text-[10px] text-label">{result.case.id}</td>
                    <td className="mono px-2 py-1 text-[10px] font-semibold text-slate">{row.node}</td>
                    <td className="px-2 py-1"><Status pass={row.pass} /></td>
                    <td className="max-w-[190px] px-2 py-1 text-[10px] leading-snug text-muted">{row.input}</td>
                    <td className="max-w-[220px] px-2 py-1 text-[10px] leading-snug text-muted">{row.expectedOutput}</td>
                    <td className="max-w-[240px] px-2 py-1 text-[10px] leading-snug text-slate">{row.actualOutput}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        {row.citations.map((id) => (
                          <span key={id} className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{id}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
          LLM call-sites · unified
        </p>
        <h2 className="mt-1 font-serif text-[16px] font-bold tracking-[-0.01em] text-ink">
          Every model-backed location, one eval shape
        </h2>
        <p className="mt-1 max-w-[760px] text-[12px] leading-snug text-muted">
          Ask-the-Hub (above) and the Status weekly-verdict generator are evaluated with the same
          input · node · expected · actual · pass contract, organized by location.
        </p>
        <div className="mt-2 rounded-card border border-hairline bg-surface p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <code className="mono text-[11px] font-semibold text-slate">{statusSite.location}</code>
            <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{statusSite.provider}</span>
            <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{statusSite.model}</span>
            <Status pass={statusSite.evalRows.every((r) => r.pass)} />
          </div>
          <p className="mt-1 text-[11px] text-muted">{statusSite.description}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-side">
                  {["Node", "Pass", "Input", "Expected out", "Actual out"].map((h) => (
                    <th key={h} className="mono px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-label">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statusSite.evalRows.map((row) => (
                  <tr key={row.node} className="border-b border-hairline last:border-0 align-top">
                    <td className="mono px-2 py-1 text-[10px] font-semibold text-slate">{row.node}</td>
                    <td className="px-2 py-1"><Status pass={row.pass} /></td>
                    <td className="max-w-[210px] px-2 py-1 text-[10px] leading-snug text-muted">{row.input}</td>
                    <td className="max-w-[230px] px-2 py-1 text-[10px] leading-snug text-muted">{row.expectedOutput}</td>
                    <td className="max-w-[260px] px-2 py-1 text-[10px] leading-snug text-slate">{row.actualOutput}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
          Persisted run traces
        </p>
        <p className="mt-1 max-w-[760px] text-[12px] leading-snug text-muted">
          Each Ask-the-Hub run now writes its sanitized trace to a durable store (DB when configured,
          else a file store) — auditable later, not just returned once. {recentTraces.length} recent.
        </p>
        <div className="mt-2 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
          {recentTraces.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-muted">No persisted traces yet — ask the Hub a question to record one.</p>
          ) : (
            recentTraces.map((t) => (
              <div key={t.runId} className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2 last:border-0">
                <code className="mono text-[10px] font-semibold text-slate">{t.runId}</code>
                <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{t.location}</span>
                <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{t.provider}</span>
                <span className="mono text-[9px] text-label">{t.startedAt}</span>
                <span className="mono ml-auto text-[9px] text-label">{t.trace.evalRows.length} eval rows</span>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="mt-6 border-t border-hairline pt-3 text-[11px] text-label">
        Eval source: <span className="mono">lib/ai/agents.ts</span> · Cases:{" "}
        <span className="mono">{ASK_EVAL_CASES.length}</span> · Help console:{" "}
        <Link href="/help/ai-agents" className="text-blue hover:underline">/help/ai-agents</Link>
      </footer>
    </div>
  );
}
