// 6d Goal pacing — required-vs-actual run-rate + a stated linear-v1 projection. A KPI
// with an uninstrumented input carries a low-confidence flag on its projection (Elena
// vs Rahman, resolved). Only Leaders may edit a goal; the control is shown read-only to
// everyone else (RBAC is enforced server-side in the goal API; this only mirrors it).

import type { PacingRow } from "@/lib/dashboard/pacing";
import { pacingMethodLabel } from "@/lib/dashboard/pacing";
import { Card, Pill, fmtValue, statusTone } from "./primitives";
import type { KpiUnit } from "@/lib/metrics/registry";
import { kpiDefinition } from "@/lib/metrics/registry";

function unitFor(key: string): KpiUnit {
  return kpiDefinition(key)?.unit ?? "count";
}

export function GoalPacing({ rows, canEdit }: { rows: PacingRow[]; canEdit: boolean }) {
  return (
    <Card
      title="Goal pacing"
      note={`Projection method: ${pacingMethodLabel()} · seasonality is a stated limitation`}
      right={
        <Pill tone={canEdit ? "good" : "neutral"}>
          {canEdit ? "Leader: goals editable" : "Goals read-only for this role"}
        </Pill>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-label">
              <th className="py-1 pr-2.5 font-semibold">KPI</th>
              <th className="py-1 pr-2.5 font-semibold">Target</th>
              <th className="py-1 pr-2.5 font-semibold">Wks left</th>
              <th className="py-1 pr-2.5 font-semibold">Required/wk</th>
              <th className="py-1 pr-2.5 font-semibold">Actual/wk</th>
              <th className="py-1 pr-2.5 font-semibold">Projection</th>
              <th className="py-1 font-semibold">Pace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const unit = unitFor(row.key);
              return (
                <tr key={row.key} className="border-b border-hairline">
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">{row.label}</span>
                      {row.confidence === "low" && <Pill tone="watch">low-confidence</Pill>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">by {row.cutoffDate}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    {canEdit ? (
                      <form action="/api/dashboard/goals" method="post" className="flex items-center gap-1.5">
                        <input type="hidden" name="kpi_key" value={row.key} />
                        <label htmlFor={`goal-${row.key}`} className="sr-only">
                          Target for {row.label}
                        </label>
                        <input
                          id={`goal-${row.key}`}
                          name="target_value"
                          type="number"
                          min="0"
                          step={unit === "pct" ? "0.1" : "1"}
                          defaultValue={row.target}
                          className="mono num h-8 w-[92px] rounded-card border border-border bg-canvas px-2 text-[12px] text-ink outline-none focus:border-gold"
                        />
                        <button
                          type="submit"
                          className="h-8 rounded-card bg-ink-cta px-2.5 text-[11px] font-semibold text-on-cta transition-transform active:translate-y-px"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <span className="mono num text-muted">{fmtValue(row.target, unit)}</span>
                    )}
                  </td>
                  <td className="mono num py-2.5 pr-3 text-muted">{row.weeksLeft}</td>
                  <td className="mono num py-2.5 pr-3 text-ink">{fmtValue(row.requiredRunRate, unit)}</td>
                  <td className="mono num py-2.5 pr-3 text-ink">{fmtValue(row.actualRunRate, unit)}</td>
                  <td className="mono num py-2.5 pr-3 font-semibold text-ink">
                    {fmtValue(row.projection, unit)}
                    {row.confidence === "low" ? " *" : ""}
                  </td>
                  <td className="py-2.5">
                    <Pill tone={statusTone(row.status)}>{row.status.replace("_", " ")}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        * projection rests on an uninstrumented input (manual or UTM-broken) — plan against it with caution.
      </p>
    </Card>
  );
}
