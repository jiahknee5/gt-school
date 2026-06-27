"use client";

import Link from "next/link";
import type { StatusCell, StatusBullet } from "@/lib/status/board";
import { RankedMiniBar } from "./dataviz/RankedMiniBar";
import { FunnelMini } from "./dataviz/FunnelMini";
import { Sparkline } from "./dataviz/Sparkline";

function ExecBullets({ bullets }: { bullets: StatusBullet[] }) {
  return (
    <ul className="space-y-1">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-1.5 font-serif text-[12px] leading-snug text-ink">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate" aria-hidden="true" />
          <span>{b.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatusCellContent({ cell, column }: { cell: StatusCell; column: "position" | "drivers" | "decisions" | "narrative" }) {
  if (cell.thin) {
    return (
      <div className="space-y-1">
        {cell.owner && (
          <p className="mono text-[10px] font-semibold uppercase tracking-wide text-label">
            {cell.owner}
          </p>
        )}
        <p className="text-[11px] italic text-muted">{cell.subline ?? cell.thinReason ?? "Thin signal — drill for context."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {cell.owner && (
        <p className="mono text-[10px] font-semibold uppercase tracking-wide text-label">
          <span className="text-slate">{cell.owner}</span>
        </p>
      )}
      {cell.stat && (
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="mono num text-[22px] font-bold leading-none text-ink">{cell.stat.value}</span>
          {cell.stat.unit && <span className="text-[10px] text-muted">{cell.stat.unit}</span>}
          {cell.stat.delta && (
            <span
              className={`mono rounded-full px-1.5 py-px text-[10px] font-bold ${
                cell.stat.deltaTone === "down"
                  ? "bg-red-soft text-red"
                  : cell.stat.deltaTone === "up"
                    ? "bg-green-soft text-green"
                    : "bg-fill text-muted"
              }`}
            >
              {cell.stat.delta}
            </span>
          )}
        </div>
      )}
      {cell.subline && <p className="text-[11px] leading-snug text-ink">{cell.subline}</p>}
      {cell.rankedBars && cell.rankedBars.length > 0 && <RankedMiniBar rows={cell.rankedBars} />}
      {cell.funnelSteps && cell.funnelSteps.length > 0 && <FunnelMini steps={cell.funnelSteps} />}
      {cell.sparkline && <Sparkline data={cell.sparkline} />}
      {cell.decision && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold leading-snug text-ink">{cell.decision.question}</p>
          {cell.decision.source && (
            <p className="mono text-[9px] text-muted">
              {cell.decision.source}
              {cell.decision.urgent && <span className="ml-1 font-bold text-red">URGENT</span>}
            </p>
          )}
          <Link
            href={cell.decision.href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 items-center rounded-card bg-ink-cta px-2.5 text-[11px] font-semibold text-on-cta"
          >
            Open queue
          </Link>
        </div>
      )}
      {cell.bullets && column === "narrative" && <ExecBullets bullets={cell.bullets} />}
      {cell.budgetSlice && (
        <p className="mono border-t border-hairline pt-1.5 text-[9px] text-muted">
          Stage spend <b className="text-ink">{cell.budgetSlice.spend}</b>
          {cell.budgetSlice.note && (
            <span className={cell.budgetSlice.derived ? " italic" : ""}> · {cell.budgetSlice.note}</span>
          )}
        </p>
      )}
      {(cell.derived || cell.derivedNote) && column === "drivers" && (
        <p className="mono text-[9px] italic text-muted">{cell.derivedNote ?? "Derived / estimated"}</p>
      )}
    </div>
  );
}
