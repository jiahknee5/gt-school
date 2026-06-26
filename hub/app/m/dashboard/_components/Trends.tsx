// 6b Trends — 4/8/12-wk series per KPI on one shared, labeled baseline. Compare-two by
// showing two KPI series side by side. Event annotations are deferred to v2 (PLAN §8).

import { kpiWeeklySeries, weekMondays, KPI_DEFINITIONS } from "@/lib/metrics/registry";
import type { SeedDataset } from "@/lib/seed/types";
import { Card, fmtValue } from "./primitives";

function TrendSeries({ ds, kpiKey, window }: { ds: SeedDataset; kpiKey: string; window: number }) {
  const def = KPI_DEFINITIONS.find((d) => d.key === kpiKey);
  if (!def) return null;
  const series = kpiWeeklySeries(kpiKey, ds);
  const weeks = weekMondays();
  const slice = series.slice(-window);
  const weekSlice = weeks.slice(-window);
  const max = Math.max(...slice, 1);
  return (
    <div className="rounded-card border border-hairline bg-canvas p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-ink">{def.label}</p>
        {!def.instrumented && <span className="mono text-[10px] font-semibold text-amber">low-confidence</span>}
      </div>
      <div className="mt-3 flex h-24 items-end gap-1" aria-hidden="true">
        {slice.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-sm bg-slate"
              style={{ height: `${Math.max(4, Math.round((v / max) * 100))}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>{weekSlice[0]}</span>
        <span>{weekSlice[weekSlice.length - 1]}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        latest {fmtValue(slice[slice.length - 1] ?? 0, def.unit)} · max {fmtValue(max, def.unit)}
      </p>
    </div>
  );
}

export function Trends({ ds, window = 8 }: { ds: SeedDataset; window?: number }) {
  return (
    <Card title="Trends" note={`Per-KPI series · ${window}-wk window · shared baseline (compare two side by side)`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <TrendSeries ds={ds} kpiKey="applicants" window={window} />
        <TrendSeries ds={ds} kpiKey="deposits" window={window} />
        <TrendSeries ds={ds} kpiKey="parity_pct" window={window} />
        <TrendSeries ds={ds} kpiKey="conversion_top_channel" window={window} />
      </div>
    </Card>
  );
}
