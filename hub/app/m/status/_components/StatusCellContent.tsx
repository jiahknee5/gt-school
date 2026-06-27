"use client";

import type { StatusCell } from "@/lib/status/board";
import { MiniBullet } from "./dataviz/MiniBullet";

type Attention = "high" | "watch" | "calm";
type PosStat = NonNullable<StatusCell["stat"]>;

// Versus last week — direction arrow (shape) + signed delta (text) + a muted "wk"
// hint. Color-blind-safe: the arrow + sign carry direction without relying on hue.
function WowChip({ wow }: { wow: NonNullable<PosStat["wow"]> }) {
  const arrow = wow.dir === "up" ? "▲" : wow.dir === "down" ? "▼" : "→";
  return (
    <span
      className="mono inline-flex items-center gap-0.5 font-semibold text-slate"
      aria-label={`Week over week ${wow.delta}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{wow.delta}</span>
      <span className="font-normal text-muted">wk</span>
    </span>
  );
}

// Versus goal — a tiny bullet/target marker (shape) + now/target or % label (text).
// Red only when behind pace; otherwise calm ink so the board stays quiet.
function GoalChip({ goal }: { goal: NonNullable<PosStat["goal"]> }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Versus goal ${goal.label}`}>
      {typeof goal.pct === "number" && <MiniBullet pct={goal.pct} tone={goal.tone} />}
      <span className={`mono ${goal.tone === "bad" ? "font-semibold text-red" : "text-slate"}`}>{goal.label}</span>
    </span>
  );
}

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
  // POSITION — one calm unit answering where / vs last week / vs goal.
  // The headline number is the "where"; a single meta line carries the compact
  // WoW chip + vs-goal marker. Full detail (deltaPct, pace) lives in the drawer.
  if (column === "position") {
    const numCls =
      attention === "high"
        ? "text-[22px] text-ink"
        : attention === "watch"
          ? "text-[20px] text-ink"
          : "text-[17px] text-slate";
    const stat = cell.stat;
    if (!stat) return <p className="text-[12px] text-muted">{cell.subline ?? "—"}</p>;
    const hasMeta = Boolean(stat.wow || stat.goal || stat.basisNote);
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className={`mono num font-bold leading-none ${numCls}`}>{stat.value}</span>
          {stat.unit && <span className="text-[10px] leading-tight text-muted">{stat.unit}</span>}
        </div>
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-none">
            {stat.wow && <WowChip wow={stat.wow} />}
            {stat.wow && stat.goal && <span className="text-muted/60" aria-hidden="true">·</span>}
            {stat.goal && <GoalChip goal={stat.goal} />}
            {!stat.wow && !stat.goal && stat.basisNote && (
              <span className="text-[9px] italic text-muted">{stat.basisNote}</span>
            )}
          </div>
        )}
      </div>
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
