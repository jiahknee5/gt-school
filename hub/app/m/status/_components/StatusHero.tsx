import type { ReactNode } from "react";
import type { StatusBoard } from "@/lib/status/board";
import { RagToken } from "./dataviz/RagToken";
import { BulletGraph } from "./dataviz/BulletGraph";

export function StatusHero({
  board,
  onDrillHero,
  askSlot,
}: {
  board: StatusBoard;
  onDrillHero: () => void;
  askSlot: ReactNode;
}) {
  const { answer, northStar } = board;

  return (
    <section className="grid gap-6 rounded-card border border-border bg-surface p-4 shadow-lg lg:grid-cols-[1.15fr_1fr_320px] lg:items-center lg:p-5">
      <button
        type="button"
        onClick={onDrillHero}
        className="min-w-0 cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <div className="mono flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-label">
          <span>The Answer</span>
          <span className="text-muted">· {board.programLabel}</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
        <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.015em] text-ink">
          {answer.headline}
        </h1>
        <ul className="mt-2 space-y-1">
          {answer.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[11px] leading-snug text-muted">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate" aria-hidden="true" />
              <span className={b.tone === "bad" ? "text-ink" : undefined}>{b.text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RagToken status={answer.rag} />
          <span className="mono text-[9px] text-muted">
            <b className="text-slate">{answer.meta.paceLabel}</b> · as of {answer.meta.asOf} ·{" "}
            <b className="text-slate">{answer.meta.daysLeft} days</b> to Aug 17
          </span>
        </div>
      </button>

      {askSlot}

      <button
        type="button"
        onClick={onDrillHero}
        className="min-w-0 cursor-pointer border-l border-hairline pl-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="mono text-[10px] font-semibold uppercase tracking-wide text-label">
            {northStar.label}
          </span>
          <span className="mono text-[18px] font-bold text-gold">
            {northStar.gap >= 0 ? `+${northStar.gap}` : northStar.gap}
          </span>
        </div>
        <p className="mono num mt-1 text-[clamp(28px,4vw,40px)] font-bold leading-none text-ink">
          {northStar.current}
          <small className="ml-1 text-[13px] font-normal text-muted">
            / {northStar.target} · {northStar.pctOfTarget}%
          </small>
        </p>
        <BulletGraph data={northStar} />
        {northStar.derivedNote && (
          <p className="mono mt-1 text-[9px] italic text-muted">{northStar.derivedNote}</p>
        )}
      </button>
    </section>
  );
}
