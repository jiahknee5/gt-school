import Link from "next/link";
import type { StatusBoard } from "@/lib/status/board";

export function StatusRail({ board }: { board: StatusBoard }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Cross-cutting rail">
      {board.rail.map((card) => (
        <Link
          key={card.key}
          href={card.href ?? "#"}
          className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-3 shadow-sm transition-colors hover:border-slate hover:bg-hover"
        >
          <span className="mono text-[10px] uppercase tracking-wide text-label">{card.kicker}</span>
          <span className="text-[12px] font-bold text-ink">{card.title}</span>
          <span className="mono text-[14px] font-bold text-ink">{card.value}</span>
          {card.subline && <span className="text-[10px] text-muted">{card.subline}</span>}
          {card.flag && <span className="mono text-[9px] font-bold text-red">{card.flag}</span>}
          {card.derived && <span className="mono text-[9px] italic text-muted">derived</span>}
        </Link>
      ))}
    </section>
  );
}
