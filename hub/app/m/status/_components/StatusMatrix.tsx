"use client";

import { Fragment } from "react";
import Link from "next/link";
import type { StatusBoard, StatusStage, RagStatus } from "@/lib/status/board";
import { RagToken } from "./dataviz/RagToken";
import { StatusCellContent } from "./StatusCellContent";

// Option C+ default board: two calm content columns only (Position + Narrative).
// Drivers (the "why" / evidence) collapses fully into the drawer; Decisions is
// surfaced per-row as a compact flag (see StageDecisionFlag), not a column.
const COLUMNS: { key: "position" | "narrative"; num: string; title: string; q: string }[] = [
  { key: "position", num: "①", title: "Position", q: "Where we stand" },
  { key: "narrative", num: "②", title: "Narrative", q: "The headline" },
];

function attentionOf(stage: StatusStage): "high" | "watch" | "calm" {
  if (stage.rag === "red" || stage.binding) return "high";
  if (stage.rag === "amber") return "watch";
  return "calm";
}

// Exception highlighting: reserve the heavy red wash for the ONE binding
// constraint. Every other stage communicates status through its compact RAG
// token alone, so the board reads calm even when several stages are at risk.
function posTint(stage: StatusStage): string {
  return stage.binding ? "bg-red-soft/40" : "";
}

// Per-row Decision flag (Option C+): the "do" affordance. Appears ONLY when a
// stage carries a real open decision; recedes to nothing on thin/operational
// stages. One color-blind-safe token (shape + text), linking straight to the
// Decision Queue; full decision detail still lives in the stage drawer.
function StageDecisionFlag({ stage }: { stage: StatusStage }) {
  const decision = stage.decisions.decision;
  if (!decision) return null;
  const urgent = Boolean(decision.urgent);
  return (
    <Link
      href={decision.href}
      onClick={(e) => e.stopPropagation()}
      title={decision.question}
      aria-label={`${stage.name} — a decision needs leadership; open the Decision Queue`}
      className={`mono mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
        urgent
          ? "border-red/40 bg-red-soft/50 text-red hover:bg-red-soft/80"
          : "border-border bg-canvas text-slate hover:border-slate"
      }`}
    >
      <span aria-hidden="true">{urgent ? "▲" : "◷"}</span>
      {urgent ? "Decide · urgent" : "Decide · needs you"}
    </Link>
  );
}

// The stage's fixed exec metric (the one reviewed every week), shown as a compact chip:
// label, this-week value, and the week-over-week delta cue. Full set lives in the drawer.
function StageExecMetric({ stage }: { stage: StatusStage }) {
  const metric = stage.metrics?.find((m) => m.surface === "exec");
  if (!metric) return null;
  const delta = metric.delta;
  const deltaTone =
    delta == null ? "text-muted" : delta > 0 ? "text-green" : delta < 0 ? "text-red" : "text-muted";
  return (
    <p
      className="mono inline-flex w-fit items-center gap-1 rounded-full border border-hairline bg-canvas px-1.5 py-0.5 text-[9px] text-slate"
      title={`${metric.label} — the metric reviewed for this stage every week`}
    >
      <span className="font-semibold text-ink">{metric.value}</span>
      <span className="text-muted">{metric.label}</span>
      {delta != null && (
        <span className={`font-semibold ${deltaTone}`}>
          {delta > 0 ? `▲${Math.abs(delta)}` : delta < 0 ? `▼${Math.abs(delta)}` : "flat"}
        </span>
      )}
    </p>
  );
}

export function StatusMatrix({
  board,
  onOpenStage,
}: {
  board: StatusBoard;
  onOpenStage: (title: string, stage: StatusStage) => void;
}) {
  return (
    <section aria-label="Funnel by executive spine">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-[10px] font-semibold text-label">
          Funnel × spine · {board.programLabel}
        </p>
        <div className="flex items-center gap-2">
          <span className="mono inline-flex items-center gap-1 text-[9px] text-muted">
            <RagToken status={"red" as RagStatus} compact /> needs attention
          </span>
          <span className="mono inline-flex items-center gap-1 rounded-full border border-border bg-canvas px-2 py-0.5 text-[10px] font-semibold text-slate">
            <span aria-hidden="true">⊕</span> Click any cell to drill into the detail
          </span>
        </div>
      </div>

      <div
        className="grid gap-x-1.5 gap-y-0 overflow-x-auto"
        style={{
          gridTemplateColumns: "minmax(160px,180px) minmax(0,1fr) minmax(0,1.25fr)",
          gridTemplateRows: `auto repeat(${board.stages.length}, minmax(60px, auto))`,
        }}
      >
        <div className="border-b border-hairline pb-2">
          <p className="mono text-[10px] uppercase text-label">Funnel ↓</p>
          <p className="font-serif text-[11px] font-semibold text-ink">Spine →</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.key} className="border-b border-hairline pb-2">
            <div className="flex items-center gap-1">
              <span className="mono text-[10px] font-semibold text-label">{col.num}</span>
              <h2 className="font-serif text-[13px] font-semibold text-ink">{col.title}</h2>
            </div>
            <p className="text-[10px] italic text-muted">{col.q}</p>
          </div>
        ))}

        {board.stages.map((stage, rowIdx) => {
          const att = attentionOf(stage);
          const rowBg = rowIdx % 2 === 1 ? "bg-surface" : "bg-canvas";
          const labelBorder = stage.binding ? "border-l-red" : "border-l-ink/20";
          return (
            <Fragment key={stage.key}>
              <div
                className={`group relative flex flex-col gap-1 border-l-[3px] p-2.5 ${labelBorder} ${
                  stage.binding ? "bg-red-soft/30" : rowBg
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenStage(stage.name, stage)}
                  className="flex flex-col items-start gap-1 text-left transition-shadow hover:ring-1 hover:ring-inset hover:ring-slate focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                >
                  <span className="mono text-[9px] font-semibold uppercase tracking-wide text-label">
                    Stage {String(stage.num).padStart(2, "0")}
                    {stage.binding && <span className="ml-1 text-red">· binding</span>}
                  </span>
                  <h3 className="font-serif text-[13px] font-bold leading-tight text-ink">{stage.name}</h3>
                  <RagToken status={stage.rag} />
                </button>
                {stage.owner && (
                  <p
                    className="mono text-[9px] leading-tight text-muted"
                    title={`Accountable owner for ${stage.name}`}
                  >
                    <span className="font-semibold text-slate">{stage.owner}</span>
                    {stage.ownerRole ? ` · ${stage.ownerRole}` : ""}
                  </p>
                )}
                <StageExecMetric stage={stage} />
                <StageDecisionFlag stage={stage} />
                <span className="mono absolute right-2 top-2 text-[11px] text-label opacity-30 group-hover:opacity-100">
                  ⊕
                </span>
              </div>

              {COLUMNS.map((col) => (
                <button
                  type="button"
                  key={`${stage.key}-${col.key}`}
                  onClick={() => onOpenStage(`${stage.name} · ${col.title}`, stage)}
                  className={`group relative min-w-0 p-2.5 text-left transition-shadow hover:ring-1 hover:ring-inset hover:ring-slate focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${rowBg} ${
                    col.key === "position" ? posTint(stage) : ""
                  }`}
                >
                  <StatusCellContent cell={stage[col.key]} column={col.key} attention={att} />
                  <span className="mono absolute right-1.5 top-1.5 text-[10px] text-label opacity-0 group-hover:opacity-100">
                    ⊕
                  </span>
                </button>
              ))}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
