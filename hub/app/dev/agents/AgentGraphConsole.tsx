"use client";

import { useState } from "react";
import type { AskHubAnswer } from "@/lib/ai/agents";
import { AgentGraphDiagram } from "./AgentGraphDiagram";

const DEFAULT_QUESTION = "Did Open Data change the Austin and Dallas field bet?";

function Status({ pass }: { pass: boolean }) {
  return (
    <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${pass ? "bg-green-soft text-green" : "bg-red-soft text-red"}`}>
      {pass ? "pass" : "fail"}
    </span>
  );
}

export function AgentGraphConsole() {
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [answer, setAnswer] = useState<AskHubAnswer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Agent run failed.");
      setAnswer(body as AskHubAnswer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-4 rounded-card border border-hairline bg-surface p-3 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={600}
          className="min-h-9 flex-1 rounded-card border border-hairline bg-canvas px-3 text-[12px] text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="rounded-card bg-ink-cta px-3 py-1.5 text-[12px] font-semibold text-on-cta disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Running..." : "Run agent graph"}
        </button>
      </div>
      {error && <p className="mt-2 rounded-card border border-red-soft bg-red-soft p-2 text-[11px] text-red">{error}</p>}

      {answer && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Run", answer.trace.runId],
              ["Mode", answer.mode],
              ["Agent", answer.agent.id],
              ["Nodes", `${answer.trace.graph.nodes.length}`],
              ["Eval pass", `${answer.evalRows.filter((row) => row.pass).length}/${answer.evalRows.length}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-card border border-hairline bg-canvas p-2">
                <p className="mono text-[9px] uppercase tracking-[0.08em] text-label">{label}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-card border border-hairline bg-side/40 p-3">
            <p className="mono mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-label">Pipeline diagram</p>
            <AgentGraphDiagram nodes={answer.trace.graph.nodes} edges={answer.trace.graph.edges} />
          </div>

          <div className="overflow-x-auto rounded-card border border-hairline">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-side">
                  {["Node", "Pass", "Input", "Output", "Actual", "Expected", "Citations"].map((h) => (
                    <th key={h} className="mono px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-label">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answer.evalRows.map((row) => (
                  <tr key={row.node} className="border-b border-hairline last:border-0 align-top">
                    <td className="mono px-2 py-1 text-[10px] font-semibold text-slate">{row.node}</td>
                    <td className="px-2 py-1"><Status pass={row.pass} /></td>
                    <td className="max-w-[180px] px-2 py-1 text-[10px] leading-snug text-muted">{row.input}</td>
                    <td className="max-w-[190px] px-2 py-1 text-[10px] leading-snug text-slate">{row.output ?? row.actualOutput}</td>
                    <td className="max-w-[190px] px-2 py-1 text-[10px] leading-snug text-slate">{row.actualOutput}</td>
                    <td className="max-w-[190px] px-2 py-1 text-[10px] leading-snug text-muted">{row.expectedOutput}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        {row.citations.map((id) => (
                          <span key={id} className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{id}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
