import type { StatusNorthStar } from "@/lib/status/board";

export function BulletGraph({ data }: { data: StatusNorthStar }) {
  const actualPct = Math.min(100, (data.current / data.target) * 100);
  const pacePct = Math.min(100, (data.pace / data.target) * 100);
  const gapIsBad = data.gap < 0;

  return (
    <div className="space-y-1">
      <div className="relative h-4 rounded-sm bg-fill">
        <span
          className="absolute left-0 top-0 h-full rounded-sm bg-slate"
          style={{ width: `${actualPct}%` }}
        />
        <span
          className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5 bg-ink"
          style={{ left: `${pacePct}%` }}
          title={`Pace ${data.pace}`}
        />
        <span className="absolute right-0 top-[-2px] h-[calc(100%+4px)] w-0.5 bg-ink/60" title={`Goal ${data.target}`} />
      </div>
      <div className="mono flex justify-between text-[9px] text-muted">
        <span>pace {data.pace}</span>
        <span>goal {data.target}</span>
      </div>
      {gapIsBad && (
        <p className="mono text-[11px] font-bold text-gold">
          {data.gap} to pace
        </p>
      )}
    </div>
  );
}
