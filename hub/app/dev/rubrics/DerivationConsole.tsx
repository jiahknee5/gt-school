"use client";

import { useState } from "react";
import Link from "next/link";
import type { DerivationGraph, DerivationKind } from "@/lib/status/derivation";
import { DerivationGraphView, KIND_BADGE } from "@/app/_components/DerivationGraphView";

export type TraceRow = { node: string; input: string; output: string; expected: string; pass: boolean };
export type RunLog = { id: string; datetime: string; entry: string; trace: TraceRow[] };
export type GeneratorRow = {
  key: string;
  label: string;
  kind: DerivationKind;
  value: string;
  source: string;
  sourceHref: string | null;
  homeModule: string;
  evalPass: boolean;
  rubric?: DerivationGraph["rubric"];
  usedBy: string[];
  runs: RunLog[];
  graph?: DerivationGraph;
  graphHref?: string;
};

function KindBadge({ kind }: { kind: DerivationKind }) {
  const b = KIND_BADGE[kind];
  return <span className={`mono rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${b.cls}`}>{b.label}</span>;
}

function TraceTable({ trace }: { trace: TraceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-hairline bg-canvas">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline bg-side">
            {["Node", "Input", "Output", "Expected", "✓"].map((h) => (
              <th key={h} className="mono px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-label">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trace.map((r, i) => (
            <tr key={i} className="border-b border-hairline last:border-0 align-top">
              <td className="mono px-2 py-1 text-[10px] font-semibold text-slate">{r.node}</td>
              <td className="px-2 py-1 text-[10px] leading-snug text-muted">{r.input}</td>
              <td className="px-2 py-1 text-[10px] leading-snug text-slate">{r.output}</td>
              <td className="px-2 py-1 text-[10px] leading-snug text-muted">{r.expected}</td>
              <td className="px-2 py-1">
                <span className={`mono text-[10px] font-bold ${r.pass ? "text-green" : "text-red"}`}>{r.pass ? "✓" : "✗"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DerivationConsole({ rows, builtAt }: { rows: GeneratorRow[]; builtAt: string }) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [sidecar, setSidecar] = useState<GeneratorRow | null>(null);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
        {/* header */}
        <div className="grid grid-cols-[20px_1.4fr_0.8fr_0.7fr_0.5fr_0.6fr] items-center gap-2 border-b border-hairline bg-side px-3 py-1.5">
          {["", "Claim generator", "Source", "Value", "Eval", "Graph"].map((h) => (
            <span key={h} className="mono text-[8px] font-semibold uppercase tracking-[0.08em] text-label">{h}</span>
          ))}
        </div>

        {rows.map((row) => {
          const rowOpen = openRow === row.key;
          return (
            <div key={row.key} className="border-b border-hairline last:border-0">
              {/* generator row */}
              <button
                type="button"
                onClick={() => { setOpenRow(rowOpen ? null : row.key); setOpenRun(null); }}
                className="grid w-full grid-cols-[20px_1.4fr_0.8fr_0.7fr_0.5fr_0.6fr] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-hover"
              >
                <span className="mono text-[10px] text-label">{rowOpen ? "▾" : "▸"}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <KindBadge kind={row.kind} />
                  <span className="truncate text-[12px] font-semibold text-ink">{row.label}</span>
                </span>
                {row.sourceHref ? (
                  <Link href={row.sourceHref} onClick={(e) => e.stopPropagation()} className="mono truncate text-[10px] text-gold hover:underline">⛁ {row.source}</Link>
                ) : (
                  <span className="mono truncate text-[10px] text-red">⛁ {row.source} (stand-in)</span>
                )}
                <span className="mono num truncate text-[11px] font-semibold text-ink">{row.value}</span>
                <span className={`mono text-[10px] font-bold ${row.evalPass ? "text-green" : "text-red"}`}>{row.evalPass ? "pass" : "fail"}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setSidecar(row); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSidecar(row); } }}
                  className="mono w-fit cursor-pointer rounded-[4px] border border-border bg-canvas px-1.5 py-0.5 text-[9px] font-semibold text-slate hover:border-slate"
                >
                  ◈ graph
                </span>
              </button>

              {/* expanded: rubric + runs */}
              {rowOpen && (
                <div className="space-y-2 bg-canvas/60 px-3 pb-3 pt-1">
                  {row.rubric && (
                    <div className="rounded-card border border-hairline bg-surface p-2.5">
                      <p className="mono text-[9px] font-semibold uppercase tracking-wide text-gold">Rubric — what the claim must state</p>
                      <p className="mt-1 text-[11px] font-semibold text-ink">{row.rubric.question}</p>
                      <ul className="mt-1 space-y-0.5">
                        {row.rubric.mustState.map((m) => (
                          <li key={m} className="flex gap-1.5 text-[10px] text-muted"><span className="text-gold">›</span>{m}</li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[10px] text-slate"><b>Must cite:</b> {row.rubric.mustCite}</p>
                      <p className="mt-0.5 text-[10px] text-amber"><b>Honesty:</b> {row.rubric.honesty}</p>
                    </div>
                  )}

                  <p className="mono text-[9px] font-semibold uppercase tracking-wide text-label">
                    Runs ({row.runs.length}) {row.kind !== "llm" && <span className="text-muted">· deterministic — identical every build</span>}
                  </p>
                  {row.runs.map((run) => {
                    const runOpen = openRun === run.id;
                    return (
                      <div key={run.id} className="rounded-card border border-hairline bg-surface">
                        <button
                          type="button"
                          onClick={() => setOpenRun(runOpen ? null : run.id)}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-hover"
                        >
                          <span className="mono text-[10px] text-label">{runOpen ? "▾" : "▸"}</span>
                          <span className="mono text-[10px] text-slate">{run.datetime}</span>
                          <span className="text-[11px] font-medium text-ink">{run.entry}</span>
                          <span className="mono ml-auto text-[9px] text-label">{run.trace.length} nodes</span>
                        </button>
                        {runOpen && <div className="px-2.5 pb-2.5"><TraceTable trace={run.trace} /></div>}
                      </div>
                    );
                  })}

                  <p className="mono text-[9px] text-label">
                    Used by {row.usedBy.length}: <span className="text-muted">{row.usedBy.join(" · ")}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mono mt-2 text-[9px] text-label">
        Built {builtAt} · {rows.length} generators · provenance: {" "}
        <span className="text-green">measured</span> = real connector/seed · {" "}
        <span className="text-amber">derived</span> = computed from real fields · {" "}
        <span className="text-red">stand-in</span> = deterministic hash (honest synthetic) · {" "}
        <span className="text-violet">LLM</span> = live model call.
      </p>

      {/* graph sidecar */}
      {sidecar && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/35" onClick={() => setSidecar(null)} aria-hidden />
          <aside className="fixed right-0 top-0 z-50 flex h-[100dvh] w-[min(480px,94vw)] flex-col border-l border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between gap-2 bg-ink-cta px-4 py-3 text-on-cta">
              <div className="flex items-center gap-2">
                <KindBadge kind={sidecar.kind} />
                <h2 className="font-serif text-[14px] font-semibold">{sidecar.label}</h2>
              </div>
              <button type="button" onClick={() => setSidecar(null)} className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-sm" aria-label="Close">✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sidecar.graph ? (
                <DerivationGraphView graph={sidecar.graph} />
              ) : (
                <div className="text-center text-[12px] text-muted">
                  <p>This is a live LLM call-site. Its full agent graph + persisted run traces live on the Agents surface.</p>
                  <Link href={sidecar.graphHref ?? "/dev/agents"} className="mono mt-3 inline-block rounded-card bg-ink-cta px-3 py-1.5 text-[11px] font-semibold text-on-cta">
                    Open /dev/agents →
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
