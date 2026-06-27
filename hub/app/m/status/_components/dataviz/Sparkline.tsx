import type { StatusCell } from "@/lib/status/board";

export function Sparkline({ data }: { data: NonNullable<StatusCell["sparkline"]> }) {
  const min = Math.min(...data.values);
  const max = Math.max(...data.values);
  const range = max - min || 1;
  const w = 64;
  const h = 22;
  const pts = data.values
    .map((v, i) => {
      const x = (i / Math.max(data.values.length - 1, 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={data.deltaLabel} role="img">
        <line x1="0" y1="2" x2={w} y2="2" stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={h - 2} x2={w} y2={h - 2} stroke="var(--border)" strokeWidth="1" />
        <polyline fill="none" stroke="var(--slate)" strokeWidth="1.5" points={pts} />
        {data.values.length > 0 && (
          <circle
            cx={(w - 4) + 2}
            cy={h - 4 - ((data.values[data.values.length - 1]! - min) / range) * (h - 8)}
            r="2.5"
            fill="var(--red)"
          />
        )}
      </svg>
      <span className="mono text-[10px] text-muted">{data.deltaLabel}</span>
    </div>
  );
}
