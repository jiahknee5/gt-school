// A real node→edge flow diagram for an Ask-the-Hub run trace. The graph is a linear
// pipeline (request.validate → … → guardrail.output-scan); we order the nodes by the edge
// chain and draw each as a status-colored card connected by a labelled arrow. Presentational
// (no client state) so it renders for the live run AND the default suite trace.

import { Fragment } from "react";
import type { AgentGraphNode, AgentGraphEdge, GraphNodeKind, GraphNodeStatus } from "@/lib/ai/agents";

const KIND_TINT: Record<GraphNodeKind, string> = {
  input: "bg-blue-soft text-blue",
  policy: "bg-amber-soft text-amber",
  retrieval: "bg-green-soft text-green",
  graph: "bg-violet-soft text-violet",
  agent: "bg-amber-soft text-gold",
  provider: "bg-blue-soft text-blue",
  synthesis: "bg-violet-soft text-violet",
  eval: "bg-fill text-slate",
};

const STATUS_RING: Record<GraphNodeStatus, string> = {
  passed: "border-green/40",
  failed: "border-red/50",
  warned: "border-gold/50",
};
const STATUS_DOT: Record<GraphNodeStatus, string> = {
  passed: "bg-green",
  failed: "bg-red",
  warned: "bg-gold",
};

/** Order nodes by following the edge chain from the node with no incoming edge. */
function orderByChain(nodes: AgentGraphNode[], edges: AgentGraphEdge[]): { node: AgentGraphNode; edgeOut?: string }[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map(edges.map((e) => [e.from, e]));
  const hasIncoming = new Set(edges.map((e) => e.to));
  const start = nodes.find((n) => !hasIncoming.has(n.id)) ?? nodes[0];
  const seen = new Set<string>();
  const seq: { node: AgentGraphNode; edgeOut?: string }[] = [];
  let cur: AgentGraphNode | undefined = start;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const e = out.get(cur.id);
    seq.push({ node: cur, edgeOut: e?.label });
    cur = e ? byId.get(e.to) : undefined;
  }
  for (const n of nodes) if (!seen.has(n.id)) seq.push({ node: n }); // safety for non-linear graphs
  return seq;
}

function NodeCard({ node, index }: { node: AgentGraphNode; index: number }) {
  return (
    <div
      className={`w-full rounded-card border bg-surface px-3 py-2 shadow-sm ${STATUS_RING[node.status] ?? "border-hairline"}`}
      title={`${node.input}\n→ ${node.actualOutput}`}
    >
      <div className="flex items-center gap-2">
        <span className="mono grid h-4 w-4 shrink-0 place-items-center rounded-full bg-fill text-[9px] font-bold text-slate">
          {index + 1}
        </span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[node.status] ?? "bg-slate"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{node.label}</span>
        <span className={`mono shrink-0 rounded-[4px] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${KIND_TINT[node.kind] ?? "bg-fill text-slate"}`}>
          {node.kind}
        </span>
        {typeof node.durationMs === "number" && (
          <span className="mono shrink-0 text-[9px] text-label">{node.durationMs}ms</span>
        )}
      </div>
      <p className="mono mt-1 truncate text-[10px] leading-snug text-muted">
        <span className="text-slate">in:</span> {node.input} <span className="text-slate">→ out:</span> {node.actualOutput}
      </p>
      {node.decision && (
        <p className="mt-0.5 truncate text-[10px] italic text-amber" title={node.decision}>⚖ {node.decision}</p>
      )}
    </div>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-0.5" aria-hidden="true">
      <span className="h-3 w-px bg-border" />
      {label && (
        <span className="mono my-0.5 rounded-full border border-hairline bg-canvas px-1.5 py-0.5 text-[8px] text-muted">
          {label}
        </span>
      )}
      <span className="-mt-1 text-[10px] leading-none text-border">▼</span>
    </div>
  );
}

export function AgentGraphDiagram({ nodes, edges }: { nodes: AgentGraphNode[]; edges: AgentGraphEdge[] }) {
  if (!nodes.length) return null;
  const seq = orderByChain(nodes, edges);
  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-stretch">
      {seq.map(({ node, edgeOut }, i) => (
        <Fragment key={node.id}>
          <NodeCard node={node} index={i} />
          {i < seq.length - 1 && <Connector label={edgeOut} />}
        </Fragment>
      ))}
    </div>
  );
}
