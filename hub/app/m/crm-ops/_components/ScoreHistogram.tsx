// Read-only lead-score visibility: histogram + tiers + score->conversion correlation
// (labeled correlation, not validation; carries n + caveat — Rahman A4).

import type { ScoringSummary } from "@/lib/crm-ops/scoring";
import { Bar, Card, Pill } from "./primitives";

export function ScoreHistogram({ scoring }: { scoring: ScoringSummary }) {
  const maxBucket = Math.max(1, ...scoring.histogram.map((b) => b.count));
  return (
    <div className="space-y-3">
      <Card
        title="Lead score distribution"
        note={`${scoring.scored} scored. ${scoring.unscored} unscored. Read-only mirror of HubSpot gt_lead_score.`}
        right={<Pill tone="neutral">read-only</Pill>}
      >
        <div className="space-y-2.5">
          {scoring.histogram.map((b) => (
            <div key={b.label} className="grid grid-cols-[64px_1fr_48px] items-center gap-2">
              <span className="mono text-[12px] text-slate">{b.label}</span>
              <Bar pct={(100 * b.count) / maxBucket} tone="neutral" />
              <span className="mono num text-[12px] text-ink">{b.count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tier breakdown" note="Deposit rate per tier. Descriptive, not a model output.">
        <div className="divide-y divide-hairline">
          {scoring.tiers.map((t) => (
            <div key={t.tier} className="grid gap-2 py-3 sm:grid-cols-[1fr_100px_100px] sm:items-center">
              <p className="text-[12px] font-semibold text-ink">{t.tier}</p>
              <span className="mono text-[11px] text-muted">{t.count} families</span>
              <Pill tone={t.depositRatePct >= 15 ? "good" : "neutral"}>{t.depositRatePct}% deposit</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Score to conversion (correlation)" note={scoring.correlation.caveat}>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-card border border-hairline bg-canvas p-2.5">
            <p className="mono text-[11px] text-label">Top quartile</p>
            <p className="mono num mt-1 text-[18px] font-bold text-ink">
              {scoring.correlation.topQuartileDepositRatePct}%
            </p>
          </div>
          <div className="rounded-card border border-hairline bg-canvas p-2.5">
            <p className="mono text-[11px] text-label">Bottom quartile</p>
            <p className="mono num mt-1 text-[18px] font-bold text-ink">
              {scoring.correlation.bottomQuartileDepositRatePct}%
            </p>
          </div>
          <div className="rounded-card border border-hairline bg-canvas p-2.5">
            <p className="mono text-[11px] text-label">Lift (n={scoring.correlation.n})</p>
            <p className="mono num mt-1 text-[18px] font-bold text-ink">
              {scoring.correlation.lift != null ? `${scoring.correlation.lift}x` : "n/a"}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Scoring rules change-log" note="Read-only audit of how the mirrored score model changed.">
        <div className="divide-y divide-hairline">
          {scoring.rulesChangeLog.map((r) => (
            <div key={r.date} className="grid gap-1 py-3 sm:grid-cols-[120px_1fr]">
              <span className="mono text-[12px] text-label">{r.date}</span>
              <p className="text-[13px] leading-relaxed text-muted">{r.change}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
