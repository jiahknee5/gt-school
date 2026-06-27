"use client";

import type { StatusCell } from "@/lib/status/board";

type Attention = "high" | "watch" | "calm";

/**
 * Default matrix cell — shows the ONE most decision-relevant thing per column.
 * Everything dense (charts, economics, full narrative, the decision card) lives
 * in the drawer. Calm cells recede; only attention cells carry visual weight.
 */
export function StatusCellContent({
  cell,
  column,
  attention,
}: {
  cell: StatusCell;
  column: "position" | "drivers" | "decisions" | "narrative";
  attention: Attention;
}) {
  // POSITION — the single headline number (the RAG lives in the row header).
  if (column === "position") {
    const numCls =
      attention === "high"
        ? "text-[22px] text-ink"
        : attention === "watch"
          ? "text-[20px] text-ink"
          : "text-[17px] text-slate";
    return cell.stat ? (
      <div className="flex items-baseline gap-1.5">
        <span className={`mono num font-bold leading-none ${numCls}`}>{cell.stat.value}</span>
        {cell.stat.unit && <span className="text-[10px] text-muted">{cell.stat.unit}</span>}
      </div>
    ) : (
      <p className="text-[12px] text-muted">{cell.subline ?? "—"}</p>
    );
  }

  // DRIVERS — one quiet line (the glance). Charts + economics → drawer.
  if (column === "drivers") {
    return (
      <p className="line-clamp-2 text-[11px] leading-snug text-muted">
        {cell.subline ?? cell.owner ?? "—"}
      </p>
    );
  }

  // DECISIONS — attention flag only. A real open decision stands out; else recede.
  if (column === "decisions") {
    if (cell.decision) {
      return (
        <div className="space-y-0.5">
          <span
            className={`mono inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide ${
              cell.decision.urgent ? "text-red" : "text-slate"
            }`}
          >
            <span aria-hidden="true">◆</span>
            {cell.decision.urgent ? "Decide · urgent" : "Decide"}
          </span>
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-ink">
            {cell.decision.question}
          </p>
        </div>
      );
    }
    return <p className="text-[11px] text-muted/70">—</p>;
  }

  // NARRATIVE — the single top bullet (the headline). Rest → drawer.
  const top = cell.bullets?.[0];
  return (
    <p className="line-clamp-2 font-serif text-[11px] leading-snug text-muted">
      {top?.text ?? cell.subline ?? "—"}
    </p>
  );
}
