// /dev/rubrics — the provenance + rubric harness for every claim the Status board makes.
// One table, each row a claim generator tagged by KIND (measured | derived | stand-in | LLM):
//   row → expand → rubric + runs (datetime + entry) → expand → traceability (node/input/
//   output/expected/pass) → ◈ graph sidecar.
// Deterministic rows are recomputed every build (identical by design); LLM rows show their
// real persisted run traces. This is the "drive the rubric deterministically + cite real
// data" surface — every value carries its data source and a self-eval.

import { DevTabs } from "../_components/DevTabs";
import { generate } from "@/lib/seed/generate";
import { defaultReportingWeek } from "@/lib/metrics/registry";
import { buildDerivations, llmCallSiteRows, type DerivationGraph } from "@/lib/status/derivation";
import { listRecentTraces } from "@/lib/ai/trace-store";
import { DerivationConsole, type GeneratorRow, type RunLog, type TraceRow } from "./DerivationConsole";

export const dynamic = "force-dynamic";

// Map a derivation graph's nodes into a node-by-node traceability log: each node's input is
// the upstream node's value, its output is its own value/detail, and the OUTPUT node carries
// the eval's expected value + pass.
function traceFromGraph(g: DerivationGraph): TraceRow[] {
  return g.nodes.map((n, i) => {
    const prev = i > 0 ? g.nodes[i - 1] : undefined;
    const isOutput = n.role === "output";
    return {
      node: n.label,
      input: prev ? prev.value ?? prev.label : "(seed)",
      output: n.value ?? n.detail,
      expected: isOutput ? g.eval.expected : n.value ?? "—",
      pass: isOutput ? g.eval.pass : true,
    };
  });
}

export default async function DevRubricsPage() {
  const week = defaultReportingWeek();
  const ds = generate({ seed: 424242, families: 1200 });
  const derivations = buildDerivations(ds, week);
  const builtAt = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Deterministic rows: one run (this build), recomputed identically every time.
  const detRows: GeneratorRow[] = derivations.map((g) => ({
    key: g.key,
    label: g.label,
    kind: g.kind,
    value: g.value,
    source: g.source,
    sourceHref: g.sourceHref,
    homeModule: g.homeModule,
    evalPass: g.eval.pass,
    rubric: g.rubric,
    usedBy: g.usedBy,
    graph: g,
    runs: [
      {
        id: `${g.key}-build`,
        datetime: builtAt,
        entry: `board build · week ${week} · ${g.eval.note}`,
        trace: traceFromGraph(g),
      },
    ],
  }));

  // LLM rows: real persisted run traces (most recent first), each a run with node traceability.
  const traces = await listRecentTraces(40);
  const llmRows: GeneratorRow[] = llmCallSiteRows().map((m) => {
    const location = m.key === "llm.ask-the-hub" ? "ask-the-hub" : "status-gen";
    const runs: RunLog[] = traces
      .filter((t) => t.location === location)
      .slice(0, 12)
      .map((t) => ({
        id: t.runId,
        datetime: t.startedAt.replace("T", " ").slice(0, 19),
        entry: `${t.provider} · ${t.model} · role ${t.role ?? "—"}`,
        trace: (t.trace.evalRows ?? []).map(
          (r): TraceRow => ({ node: r.node, input: r.input, output: r.actualOutput, expected: r.expectedOutput, pass: r.pass }),
        ),
      }));
    return {
      key: m.key,
      label: m.label,
      kind: m.kind,
      value: runs.length ? `${runs.length} runs` : "no runs yet",
      source: m.source,
      sourceHref: m.sourceHref,
      homeModule: m.homeModule,
      evalPass: runs.every((r) => r.trace.every((n) => n.pass)),
      rubric: {
        question: m.formula,
        mustState: ["the live model + provider", "node-level traceability (input/expected/actual/pass)", "that it is a live LLM call, persisted to the trace store"],
        mustCite: "Anthropic (the model) — grounded in the deterministic draft + cited sources",
        honesty: "LLM output must pass the rubric conformance check; it never invents figures — it rewrites the grounded deterministic draft.",
      },
      usedBy: m.usedBy,
      graphHref: m.sourceHref ?? "/dev/agents",
      runs,
    };
  });

  const rows = [...llmRows, ...detRows];
  const counts = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">Developer · Rubrics &amp; provenance</p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Every claim — its rubric, derivation, eval, and run log
      </h1>
      <p className="mt-1.5 max-w-[820px] text-[12px] leading-snug text-muted">
        One row per claim generator. Each is tagged by provenance — <b className="text-green">measured</b>,{" "}
        <b className="text-amber">derived</b>, <b className="text-red">stand-in</b>, or <b className="text-violet">LLM</b> —
        so honesty is visible at a glance. Expand a row for its rubric + runs; expand a run for node-by-node
        traceability (input · output · expected · pass); open <b>◈ graph</b> for the derivation sidecar. Every
        deterministic value carries a self-eval (recomputed == rendered) and cites its data source.
      </p>

      <DevTabs />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {([
          ["Generators", `${rows.length}`],
          ["Measured", `${counts.measured ?? 0}`],
          ["Derived", `${counts.derived ?? 0}`],
          ["Stand-in", `${counts["stand-in"] ?? 0}`],
          ["LLM", `${counts.llm ?? 0}`],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <DerivationConsole rows={rows} builtAt={builtAt} />
      </div>
    </div>
  );
}
