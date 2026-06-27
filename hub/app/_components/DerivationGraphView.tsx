// The agent-graph "sidecar" for a single claim's derivation: source → filter → transform →
// output, drawn as status-colored node cards connected by labelled arrows. The source node
// carries its data-source citation; the output node carries the final rendered value. Shares
// the visual language of the Ask-the-Hub AgentGraphDiagram so both read the same way. Used by
// the /dev/rubrics console AND inline in the Status drawer.

import { Fragment } from "react";
import Link from "next/link";
import type { DerivationGraph, DerivationNode, DerivationNodeRole, DerivationKind } from "@/lib/status/derivation";

const ROLE_TINT: Record<DerivationNodeRole, string> = {
  source: "bg-blue-soft text-blue",
  filter: "bg-amber-soft text-amber",
  transform: "bg-violet-soft text-violet",
  output: "bg-green-soft text-green",
};

export const KIND_BADGE: Record<DerivationKind, { label: string; cls: string }> = {
  measured: { label: "measured", cls: "bg-green-soft text-green" },
  derived: { label: "derived", cls: "bg-amber-soft text-amber" },
  "stand-in": { label: "stand-in", cls: "bg-red-soft text-red" },
  llm: { label: "LLM", cls: "bg-violet-soft text-violet" },
};

function NodeCard({ node, index }: { node: DerivationNode; index: number }) {
  return (
    <div className="w-full rounded-card border border-hairline bg-surface px-3 py-2 shadow-sm" title={node.detail}>
      <div className="flex items-center gap-2">
        <span className="mono grid h-4 w-4 shrink-0 place-items-center rounded-full bg-fill text-[9px] font-bold text-slate">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{node.label}</span>
        <span className={`mono shrink-0 rounded-[4px] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${ROLE_TINT[node.role]}`}>
          {node.role}
        </span>
      </div>
      <p className="mono mt-1 line-clamp-2 text-[10px] leading-snug text-muted">{node.detail}</p>
      <div className="mt-1 flex items-center gap-2">
        {node.value && <span className="mono text-[10px] font-semibold text-ink">→ {node.value}</span>}
        {node.role === "source" &&
          node.source &&
          (node.sourceHref ? (
            <Link href={node.sourceHref} className="mono ml-auto text-[9px] font-semibold text-gold hover:underline">
              ⛁ {node.source}
            </Link>
          ) : (
            <span className="mono ml-auto text-[9px] font-semibold text-red">⛁ {node.source} (no connector)</span>
          ))}
      </div>
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

export function DerivationGraphView({ graph }: { graph: DerivationGraph }) {
  const labelFor = (fromId: string) => graph.edges.find((e) => e.from === fromId)?.label;
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-stretch">
      <p className="mono mb-2 text-center text-[10px] text-muted">{graph.formula}</p>
      {graph.nodes.map((node, i) => (
        <Fragment key={node.id}>
          <NodeCard node={node} index={i} />
          {i < graph.nodes.length - 1 && <Connector label={labelFor(node.id)} />}
        </Fragment>
      ))}
    </div>
  );
}
