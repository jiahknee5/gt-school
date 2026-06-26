// 10a — Budget table. The headline "watch a budget reconcile to the total" surface.
// Per-row {recommended, planned, committed, actual, remaining, available} + a total row
// that reconciles to exactly $365,000. RBAC is VISIBLE (Lindqvist): the viewer's owned
// rows render an inline spend-entry form; every other row is greyed read-only. The
// server route is still authoritative — the UI just mirrors the rule honestly.

import type { DemoUser } from "@/lib/phase2";
import type { Reconciliation } from "@/lib/budget/reconcile";
import { workstreamHealth } from "@/lib/metrics/budget";
import { canWriteEntry, ownerRoleFor } from "@/lib/budget/rbac";
import { Card, Pill, healthTone, usd } from "./primitives";

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export function BudgetTable({ recon, viewer }: { recon: Reconciliation; viewer: DemoUser }) {
  const reconcilePill = recon.reconciles ? (
    <Pill tone="good">Reconciles to $365,000</Pill>
  ) : (
    <Pill tone="risk">Reconciliation broken</Pill>
  );

  return (
    <Card
      title="Budget table"
      note="Five columns, one definition each: remaining = planned - actual, available = planned - committed. Aggregates are derived from the append-only ledger."
      right={reconcilePill}
    >
      {!recon.reconciles && (
        <p role="alert" className="mb-2.5 rounded-card border border-red-soft bg-red-soft p-3 text-[13px] text-red">
          {recon.reconcileError}
        </p>
      )}
      {recon.doubleCountedCampaigns.length > 0 && (
        <p role="alert" className="mb-2.5 rounded-card border border-red-soft bg-red-soft p-3 text-[13px] text-red">
          Double-counted campaign spend: {recon.doubleCountedCampaigns.join(", ")} appears as both a campaign
          roll-in and a manual entry.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-label">
              <th className="py-1 pr-2.5 font-semibold">Workstream</th>
              <th className="py-2 px-3 text-right font-semibold">Recommended</th>
              <th className="py-2 px-3 text-right font-semibold">Planned</th>
              <th className="py-2 px-3 text-right font-semibold">Committed</th>
              <th className="py-2 px-3 text-right font-semibold">Actual</th>
              <th className="py-2 px-3 text-right font-semibold">Remaining</th>
              <th className="py-2 pl-3 font-semibold">Entry</th>
            </tr>
          </thead>
          <tbody>
            {recon.rows.map((row) => {
              const health = workstreamHealth(row.planned, row.actual);
              const mine = canWriteEntry(viewer, row.key);
              return (
                <tr key={row.key} className={`border-b border-hairline ${mine ? "" : "opacity-70"}`}>
                  <td className="py-3 pr-3 align-top">
                    <p className="font-semibold text-ink">{row.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Pill tone={healthTone(health)}>{health}</Pill>
                      {row.campaignActual > 0 && (
                        <span className="mono text-[11px] text-muted">incl. {usd(row.campaignActual)} campaign</span>
                      )}
                    </div>
                    <p className="mono mt-0.5 text-[11px] text-muted">
                      {row.lastEdit
                        ? `last: ${usd(row.lastEdit.amount)} ${row.lastEdit.kind} by ${row.lastEdit.entered_by} · ${fmtDate(row.lastEdit.created_at)}`
                        : "no entries yet — $0 actual"}
                    </p>
                  </td>
                  <td className="mono num px-3 py-3 text-right align-top text-slate">{usd(row.recommended)}</td>
                  <td className="mono num px-3 py-3 text-right align-top text-ink">{usd(row.planned)}</td>
                  <td className="mono num px-3 py-3 text-right align-top text-ink">{usd(row.committed)}</td>
                  <td className="mono num px-3 py-3 text-right align-top text-ink">{usd(row.actual)}</td>
                  <td className={`mono num px-3 py-3 text-right align-top ${row.remaining < 0 ? "text-red" : "text-ink"}`}>
                    {usd(row.remaining)}
                  </td>
                  <td className="py-3 pl-3 align-top">
                    {mine ? (
                      <form
                        action="/api/budget/entries"
                        method="post"
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <input type="hidden" name="workstream_key" value={row.key} />
                        <select
                          name="kind"
                          defaultValue="actual"
                          aria-label={`Entry kind for ${row.name}`}
                          className="rounded-card border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink"
                        >
                          <option value="actual">actual</option>
                          <option value="committed">committed</option>
                        </select>
                        <input
                          type="number"
                          name="amount"
                          min="1"
                          step="1"
                          placeholder="$ amount"
                          aria-label={`Spend amount for ${row.name}`}
                          className="w-24 rounded-card border border-border bg-canvas px-2 py-1 text-[11px] text-ink"
                        />
                        <button
                          type="submit"
                          className="rounded-card bg-ink-cta px-2.5 py-1 text-[11px] font-semibold text-on-cta transition-transform active:translate-y-px"
                        >
                          Record spend
                        </button>
                      </form>
                    ) : (
                      <span className="mono text-[11px] text-muted">
                        Read-only · owned by {ownerRoleFor(row.key)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-3 pr-3 text-ink">
                Total
                <span className="ml-2">{reconcilePill}</span>
              </td>
              <td className="mono num px-3 py-3 text-right text-ink">{usd(recon.totals.recommended)}</td>
              <td className="mono num px-3 py-3 text-right text-ink">{usd(recon.totals.planned)}</td>
              <td className="mono num px-3 py-3 text-right text-ink">{usd(recon.totals.committed)}</td>
              <td className="mono num px-3 py-3 text-right text-ink">{usd(recon.totals.actual)}</td>
              <td className="mono num px-3 py-3 text-right text-ink">{usd(recon.totals.remaining)}</td>
              <td className="py-3 pl-3" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Corrections are new rows (append-only) — there is no in-place edit, so every number traces to a
        ledger entry with who/when. You can write to {viewer.owns.length || (viewer.role === "admin" ? "all" : 0)}{" "}
        workstream row(s) as {viewer.title}.
      </p>
    </Card>
  );
}
