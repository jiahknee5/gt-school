// 10c — Spend by workstream. Share of ACTUAL allocation (labelled actual, never planned),
// so "where is the money actually going?" is honest (Zhang's falsifiable ask).

import type { AllocationSlice } from "@/lib/metrics/budget";
import { Bar, Card, usd } from "./primitives";

const TINTS = ["bg-gold", "bg-green", "bg-amber", "bg-slate"] as const;
const BAR_TONES = ["neutral", "good", "watch", "neutral"] as const;

export function SpendByWorkstream({ slices }: { slices: AllocationSlice[] }) {
  const total = slices.reduce((s, x) => s + x.actual, 0);

  if (total === 0) {
    return (
      <Card title="Spend by workstream" note="Share of total actual spend.">
        <p className="text-[13px] text-muted">No actual spend yet — nothing to allocate.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Spend by workstream"
      note={`Share of total ACTUAL spend (${usd(total)}) — not planned allocation.`}
    >
      {/* Stacked share bar (actual) */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-fill" aria-hidden="true">
        {slices.map((s, i) => (
          <div
            key={s.key}
            className={TINTS[i % TINTS.length]}
            style={{ width: `${s.pct}%` }}
            title={`${s.name}: ${s.pct}%`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {slices.map((s, i) => (
          <li key={s.key} className="grid grid-cols-[1fr_72px_64px] items-center gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">{s.name}</p>
              <div className="mt-1">
                <Bar pct={s.pct} tone={BAR_TONES[i % BAR_TONES.length]} />
              </div>
            </div>
            <span className="mono num text-right text-[13px] text-ink">{usd(s.actual)}</span>
            <span className="mono num text-right text-[13px] text-muted">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
