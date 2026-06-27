"use client";

import { Fragment } from "react";
import type { StatusBoard, StatusStage, RagStatus } from "@/lib/status/board";
import { RagToken } from "./dataviz/RagToken";
import { StatusCellContent } from "./StatusCellContent";

const COLUMNS: { key: "position" | "drivers" | "decisions" | "narrative"; num: string; title: string; q: string }[] = [
  { key: "position", num: "①", title: "Position", q: "Where we stand" },
  { key: "drivers", num: "②", title: "Drivers", q: "What's driving it" },
  { key: "decisions", num: "③", title: "Decisions", q: "What needs you" },
  { key: "narrative", num: "④", title: "Narrative", q: "The headline" },
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
          gridTemplateColumns: "150px 1fr 1fr 1.05fr 1.1fr",
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
              <button
                type="button"
                onClick={() => onOpenStage(stage.name, stage)}
                className={`group relative flex flex-col gap-1 border-l-[3px] p-2.5 text-left transition-shadow hover:ring-1 hover:ring-inset hover:ring-slate focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${labelBorder} ${
                  stage.binding ? "bg-red-soft/30" : rowBg
                }`}
              >
                <span className="mono text-[9px] font-semibold uppercase tracking-wide text-label">
                  Stage {String(stage.num).padStart(2, "0")}
                  {stage.binding && <span className="ml-1 text-red">· binding</span>}
                </span>
                <h3 className="font-serif text-[13px] font-bold leading-tight text-ink">{stage.name}</h3>
                <RagToken status={stage.rag} />
                <span className="mono absolute right-2 top-2 text-[11px] text-label opacity-30 group-hover:opacity-100">
                  ⊕
                </span>
              </button>

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
