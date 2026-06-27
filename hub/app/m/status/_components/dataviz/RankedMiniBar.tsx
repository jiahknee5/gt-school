import type { RankedBarRow } from "@/lib/status/board";

export function RankedMiniBar({ rows }: { rows: RankedBarRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(48px,1.1fr)_1fr_auto_auto] items-center gap-1.5 text-[10px]">
          <span className="truncate text-muted">
            {row.label}
            {row.tag === "engine" && (
              <span className="mono ml-1 rounded-sm bg-green-soft px-1 text-[9px] font-bold text-green">ENGINE</span>
            )}
            {row.tag === "trap" && (
              <span className="mono ml-1 rounded-sm bg-red-soft px-1 text-[9px] font-bold text-red">TRAP</span>
            )}
          </span>
          <span className="h-1.5 overflow-hidden rounded-sm bg-fill">
            <span
              className={`block h-full rounded-sm ${row.tone === "bad" ? "bg-red" : row.tone === "good" ? "bg-green" : "bg-slate"}`}
              style={{ width: `${Math.min(100, row.pct)}%` }}
            />
          </span>
          <span className="mono text-right text-[10px] font-bold text-ink">{row.displayValue}</span>
          {row.volume ? <span className="mono text-right text-[9px] text-muted">{row.volume}</span> : <span />}
        </div>
      ))}
    </div>
  );
}
