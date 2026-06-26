// 6a Scorecard — the canonical shared table: ONE row per KPI. Identical for all roles.
// This same component renders as the Home widget (ScorecardWidget) so the number never
// drifts across surfaces (Priya). Each row carries source, freshness, and confidence.

import type { Scorecard, ScorecardRow } from "@/lib/dashboard/scorecard";
import { humanizeAge } from "@/lib/dashboard/freshness";
import { Card, Pill, Sparkline, fmtValue, statusTone, type Tone } from "./primitives";

function deltaTone(row: ScorecardRow): Tone {
  if (row.delta === 0) return "neutral";
  const good = row.delta > 0; // all current KPIs are higher_better
  return good ? "good" : "risk";
}

function deltaLabel(row: ScorecardRow): string {
  const sign = row.delta > 0 ? "+" : "";
  const base = `${sign}${fmtValue(row.delta, row.unit)}`;
  return row.deltaPct !== null ? `${base} (${sign}${row.deltaPct}%)` : base;
}

export function Scorecard({ scorecard, compact = false }: { scorecard: Scorecard; compact?: boolean }) {
  const { rows, biggestMover, redFlags, weekOf } = scorecard;
  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid gap-2 sm:grid-cols-2">
          <article className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
            <p className="mono text-[10px] font-semibold text-label">Biggest mover</p>
            {biggestMover ? (
              <p className="mt-2 text-[14px] font-semibold text-ink">
                {biggestMover.label}: {deltaLabel(biggestMover)}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted">No instrumented mover this week.</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted">Ranked by % change among measured KPIs only.</p>
          </article>
          <article className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
            <p className="mono text-[10px] font-semibold text-label">Red flags</p>
            {redFlags.length ? (
              <p className="mt-2 text-[14px] font-semibold text-red">
                {redFlags.map((r) => r.label).join(", ")}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-green">No KPI at risk this week.</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted">At-risk = below 90% of the required run-rate.</p>
          </article>
        </div>
      )}

      <div data-tour={compact ? undefined : "tour-dashboard-scorecard"}>
        <Card title="Weekly scorecard" note={`Versioned snapshot. Week of ${weekOf}. Identical for every role.`}>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-label">
                <th className="py-1 pr-2.5 font-semibold">KPI</th>
                <th className="py-1 pr-2.5 font-semibold">This wk</th>
                <th className="py-1 pr-2.5 font-semibold">Last wk</th>
                <th className="py-1 pr-2.5 font-semibold">Delta</th>
                <th className="py-1 pr-2.5 font-semibold">4-wk</th>
                <th className="py-1 pr-2.5 font-semibold">Target</th>
                <th className="py-1 pr-2.5 font-semibold">Status</th>
                <th className="py-1 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-hairline align-middle">
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">{row.label}</span>
                      {!row.instrumented && <Pill tone="watch">low-confidence</Pill>}
                      {row.stale && <Pill tone="risk">stale</Pill>}
                    </div>
                  </td>
                  <td className="mono num py-2.5 pr-3 font-semibold text-ink">{fmtValue(row.thisWeek, row.unit)}</td>
                  <td className="mono num py-2.5 pr-3 text-muted">{fmtValue(row.lastWeek, row.unit)}</td>
                  <td className="py-2.5 pr-3">
                    <Pill tone={deltaTone(row)}>{deltaLabel(row)}</Pill>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Sparkline values={row.sparkline} tone={statusTone(row.status)} />
                  </td>
                  <td className="mono num py-2.5 pr-3 text-muted">
                    {row.target !== null ? fmtValue(row.target, row.unit) : "n/a"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Pill tone={statusTone(row.status)}>{row.status.replace("_", " ")}</Pill>
                  </td>
                  <td className="py-2.5 text-[11px] text-muted">
                    {row.source}
                    {row.freshness ? `, ${humanizeAge(row.freshness.ageMinutes)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
