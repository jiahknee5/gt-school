"use client";

import { Fragment } from "react";
import type { StatusBoard, StatusStage } from "@/lib/status/board";
import { RagToken } from "./dataviz/RagToken";
import { StatusCellContent } from "./StatusCellContent";

const COLUMNS: { key: StatusStage["position"] extends infer _ ? "position" | "drivers" | "decisions" | "narrative" : never; num: string; title: string; q: string; disc?: boolean }[] = [
  { key: "position", num: "①", title: "Position", q: "Where we stand" },
  { key: "drivers", num: "②", title: "Drivers", q: "What's driving it", disc: true },
  { key: "decisions", num: "③", title: "Decisions", q: "What we're doing" },
  { key: "narrative", num: "④", title: "Narrative", q: "The headline", disc: true },
];

export function StatusMatrix({
  board,
  onOpenStage,
}: {
  board: StatusBoard;
  onOpenStage: (title: string, stage: StatusStage) => void;
}) {
  return (
    <section aria-label="Funnel by executive spine">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="mono text-[10px] font-semibold text-label">
          Funnel × spine · {board.programLabel}
        </p>
        <span className="mono inline-flex items-center gap-1 rounded-full border border-border bg-canvas px-2 py-0.5 text-[10px] font-semibold text-slate">
          <span aria-hidden="true">⊕</span> Click any cell for drill-down
        </span>
      </div>

      <div
        className="grid gap-x-2 gap-y-0 overflow-x-auto"
        style={{
          gridTemplateColumns: "150px 0.85fr 1.3fr 1.05fr 0.95fr",
          gridTemplateRows: `auto repeat(${board.stages.length}, minmax(96px, auto))`,
        }}
      >
        <div className="border-b border-hairline pb-2">
          <p className="mono text-[10px] uppercase text-label">Funnel ↓</p>
          <p className="font-serif text-[11px] font-semibold text-ink">Spine →</p>
        </div>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`border-b border-hairline pb-2 ${col.disc ? "bg-canvas/50" : ""}`}
          >
            <div className="flex items-center gap-1">
              <span className="mono text-[10px] font-semibold text-label">{col.num}</span>
              <h2 className="font-serif text-[13px] font-semibold text-ink">{col.title}</h2>
            </div>
            <p className="text-[10px] italic text-muted">{col.q}</p>
          </div>
        ))}

        {board.stages.map((stage, rowIdx) => (
          <Fragment key={stage.key}>
            <button
              type="button"
              onClick={() => onOpenStage(stage.name, stage)}
              className={`group relative flex flex-col gap-1.5 border-l-[3px] p-3 text-left transition-shadow hover:ring-1 hover:ring-inset hover:ring-slate focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                stage.binding ? "border-l-red bg-red-soft/30" : "border-l-ink"
              } ${rowIdx % 2 === 1 ? "bg-surface" : "bg-canvas"}`}
            >
              <span className="mono text-[10px] font-semibold uppercase tracking-wide text-label">
                {String(stage.num).padStart(2, "0")} {stage.name}
              </span>
              <h3 className="font-serif text-[13px] font-bold leading-tight text-ink">{stage.name}</h3>
              <div className="flex flex-wrap gap-1">
                {stage.modules.map((m) => (
                  <span
                    key={m.slug}
                    className={`mono rounded-sm border border-border bg-canvas px-1 text-[9px] font-semibold text-slate ${m.recur ? "border-dashed" : ""}`}
                  >
                    {m.label}
                    {m.recur ? " ↩" : ""}
                  </span>
                ))}
              </div>
              <RagToken status={stage.rag} />
              <span className="mono absolute right-2 top-2 text-[11px] text-label opacity-40 group-hover:opacity-100">
                ⊕
              </span>
            </button>

            {(["position", "drivers", "decisions", "narrative"] as const).map((colKey) => (
              <button
                type="button"
                key={`${stage.key}-${colKey}`}
                onClick={() => onOpenStage(`${stage.name} · ${colKey}`, stage)}
                className={`group relative min-w-0 p-3 text-left transition-shadow hover:ring-1 hover:ring-inset hover:ring-slate focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                  rowIdx % 2 === 1 ? "bg-surface" : "bg-canvas"
                } ${colKey === "drivers" || colKey === "narrative" ? "bg-canvas/30" : ""}`}
              >
                <StatusCellContent cell={stage[colKey]} column={colKey} />
                <span className="mono absolute right-2 top-2 text-[11px] text-label opacity-0 group-hover:opacity-100">
                  ⊕ details
                </span>
              </button>
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
