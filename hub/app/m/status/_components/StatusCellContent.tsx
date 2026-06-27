"use client";

import type { StatusCell } from "@/lib/status/board";

type Attention = "high" | "watch" | "calm";

/**
 * Default matrix cell — shows the ONE most decision-relevant thing per column.
 *
 * Option C+: the calm default board carries only two content columns —
 * Position (where + on-track) and Narrative (the so-what). Drivers (the "why" /
 * evidence) collapses fully into the drawer, and Decisions is surfaced as a
 * per-row flag (see StatusMatrix), not a cell. So this renderer handles only
 * the two visible columns; all dense detail lives in the drawer.
 */
export function StatusCellContent({
  cell,
  column,
  attention,
}: {
  cell: StatusCell;
  column: "position" | "narrative";
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

  // NARRATIVE — the single top bullet (the headline). Rest → drawer.
  const top = cell.bullets?.[0];
  return (
    <p className="line-clamp-2 font-serif text-[11px] leading-snug text-muted">
      {top?.text ?? cell.subline ?? "—"}
    </p>
  );
}
