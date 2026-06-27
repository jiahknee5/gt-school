// 6a Scorecard — the canonical shared table: ONE row per KPI. Identical for all roles.
// This same component renders as the Home widget (ScorecardWidget) so the number never
// drifts across surfaces (Priya). Each row carries source, freshness, and confidence.

import type { Scorecard, ScorecardRow } from "@/lib/dashboard/scorecard";
import { humanizeAge } from "@/lib/dashboard/freshness";
import { MetricCite } from "@/app/_components/MetricCite";
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

// Plain-language pace label keyed off the same status the pill uses, so "ahead / on pace /
// behind" never contradicts the colored pill. `ahead` is split out when we're past 100%.
function paceLabel(row: ScorecardRow): string {
  if (row.pctToTarget === null) return "no target";
  if (row.status === "on_track") return row.pctToTarget > 100 ? "ahead" : "on pace";
  if (row.status === "watch") return "slightly behind";
  return "behind";
}

// One scorecard row, rendered identically whether grouped or flat (format unchanged).
function ScorecardRowTr({ row }: { row: ScorecardRow }) {
  return (
    <tr className="border-b border-hairline align-middle">
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
      <td className="mono num py-2.5 pr-3">
        {row.target !== null ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink">{fmtValue(row.target, row.unit)}</span>
            {row.pctToTarget !== null && (
              <span className="text-[10px] text-muted">{row.pctToTarget}% to goal</span>
            )}
          </div>
        ) : (
          <span className="text-muted">no goal set</span>
        )}
      </td>
      <td className="py-2.5 pr-3">
        {row.target !== null ? (
          <Pill tone={statusTone(row.status)}>{paceLabel(row)}</Pill>
        ) : (
          <Pill tone="neutral">no target</Pill>
        )}
      </td>
      <td className="py-2.5 text-[11px] text-muted">
        <MetricCite
          source={row.source}
          homeModule={row.homeModule}
          trailing={row.freshness ? humanizeAge(row.freshness.ageMinutes) : undefined}
        />
      </td>
    </tr>
  );
}

// Subtle funnel-stage header spanning the table — labels the group without
// disturbing the row format. Cross-cutting trails the funnel stages.
function GroupHeaderTr({ name, blurb }: { name: string; blurb: string }) {
  return (
    <tr className="bg-fill/50">
      <td colSpan={8} className="border-b border-hairline px-0 pb-1 pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">{name}</span>
          <span className="text-[10px] text-muted">{blurb}</span>
        </div>
      </td>
    </tr>
  );
}

export function Scorecard({ scorecard, compact = false }: { scorecard: Scorecard; compact?: boolean }) {
  const { rows, groups, biggestMover, redFlags, weekOf } = scorecard;
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
        <Card
          title="Weekly scorecard"
          note={`Versioned snapshot. Week of ${weekOf}. Ordered by funnel stage. Identical for every role.`}
        >
          <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-label">
                <th className="py-1 pr-2.5 font-semibold">KPI</th>
                <th className="py-1 pr-2.5 font-semibold">This wk</th>
                <th className="py-1 pr-2.5 font-semibold">Last wk</th>
                <th className="py-1 pr-2.5 font-semibold">Delta</th>
                <th className="py-1 pr-2.5 font-semibold">4-wk</th>
                <th className="py-1 pr-2.5 font-semibold">Goal / target</th>
                <th className="py-1 pr-2.5 font-semibold">Pace to goal</th>
                <th className="py-1 font-semibold">Source</th>
              </tr>
            </thead>
            {compact ? (
              // Home widget: flat rows (no group chrome) to keep the small surface calm.
              <tbody>
                {rows.map((row) => (
                  <ScorecardRowTr key={row.key} row={row} />
                ))}
              </tbody>
            ) : (
              // Dashboard: one tbody per funnel stage, each led by a subtle stage header,
              // so the funnel structure reads top-to-bottom while rows keep their format.
              groups.map((group) => (
                <tbody key={group.key}>
                  <GroupHeaderTr name={group.name} blurb={group.blurb} />
                  {group.rows.map((row) => (
                    <ScorecardRowTr key={row.key} row={row} />
                  ))}
                </tbody>
              ))
            )}
          </table>
          </div>
          <p className="mt-2.5 text-[11px] text-muted">
            Rows follow the marketing funnel (Awareness &rarr; Acquisition &rarr; Activation &rarr;
            Nurture &rarr; Conversion &rarr; Advocacy), the same stage order as the Status board;
            cross-cutting metrics trail. Pace to goal compares this week against the per-week
            Fall-2026 target (the same goal a Leader edits in Goal pacing). On pace / ahead = at or
            above target; slightly behind = within 10%; behind = below 90%. Summer Camp runs a
            separate P&L and is not folded in here.
          </p>
        </Card>
      </div>
    </div>
  );
}
