// 10b — Burn chart. Cumulative ACTUAL vs a linear PLAN-PACE line (weekly), with a
// projected burn-out date and remaining. Chart honesty (Zhang): the plan reference
// series is always present, so "are we ahead or behind?" reads straight off the chart.

import type { BurnSeries } from "@/lib/metrics/budget";
import { Card, Pill, usd } from "./primitives";

const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function points(values: number[], maxY: number, weeks: number): string {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  return values
    .map((v, i) => {
      const x = PAD.left + (weeks <= 1 ? 0 : (i / (weeks - 1)) * plotW);
      const y = PAD.top + plotH - (maxY === 0 ? 0 : (v / maxY) * plotH);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function BurnChart({ burn }: { burn: BurnSeries }) {
  if (burn.points.length === 0) {
    return (
      <Card title="Burn chart" note="Cumulative actual vs the linear plan pace line.">
        <p className="text-[11px] text-muted">No actual spend recorded yet — nothing to burn.</p>
      </Card>
    );
  }

  const maxY = Math.max(burn.plannedTotal, ...burn.points.map((p) => p.cumulativeActual)) || 1;
  const actualLine = points(burn.points.map((p) => p.cumulativeActual), maxY, burn.weeks);
  const planLine = points(burn.points.map((p) => p.planPace), maxY, burn.weeks);
  const paceTone = burn.pace === "behind" ? "risk" : burn.pace === "ahead" ? "good" : "neutral";

  return (
    <Card
      title="Burn chart"
      note="Cumulative actual (solid) vs the linear plan pace (dashed). Weekly grain from the ledger."
      right={<Pill tone={paceTone}>{burn.pace} vs plan</Pill>}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-card border border-hairline bg-canvas p-2.5">
          <p className="mono text-[11px] text-label">Actual to date</p>
          <p className="mono num mt-1 text-[18px] font-semibold text-ink">{usd(burn.actualTotal)}</p>
        </div>
        <div className="rounded-card border border-hairline bg-canvas p-2.5">
          <p className="mono text-[11px] text-label">Remaining</p>
          <p className="mono num mt-1 text-[18px] font-semibold text-ink">{usd(burn.remaining)}</p>
        </div>
        <div className="rounded-card border border-hairline bg-canvas p-2.5">
          <p className="mono text-[11px] text-label">Projected burn-out</p>
          <p className="mono num mt-1 text-[18px] font-semibold text-ink">
            {burn.projectedBurnOutDate ?? "—"}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label="Cumulative actual spend versus the linear plan pace over the sprint weeks"
      >
        {/* y-axis gridlines at 0/50/100% of max */}
        {[0, 0.5, 1].map((f) => {
          const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--hairline)" strokeWidth="1" />
              <text x={8} y={y + 4} className="mono" fontSize="10" fill="var(--label)">
                {usd(maxY * f)}
              </text>
            </g>
          );
        })}
        <polyline points={planLine} fill="none" stroke="var(--slate)" strokeWidth="2" strokeDasharray="5 4" />
        <polyline points={actualLine} fill="none" stroke="var(--gold)" strokeWidth="2.5" />
      </svg>

      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-5 rounded-full" style={{ background: "var(--gold)" }} /> Cumulative actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5" style={{ background: "var(--slate)" }} /> Linear plan pace
        </span>
        <span>Weekly burn rate ~ {usd(burn.weeklyRate)}/wk over {burn.weeks} weeks</span>
      </div>
    </Card>
  );
}
