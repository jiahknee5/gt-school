// One decision rendered as a card. Carries every field a leader needs to rule WITHOUT
// opening another module (Ortiz's decision-sufficiency catch). Leader act controls
// (DecisionActions) only mount for still-open rows; decided/awaiting rows render their
// outcome read-only.

import type { Decision } from "@/lib/seed/types";
import { outcomeLabel, outcomeTone, type OutcomeTone } from "@/lib/decisions/queries";
import { DecisionActions } from "./DecisionActions";

function toneClass(tone: OutcomeTone): string {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
}

function clean(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "to")
    .replace(/\u2248/g, "about")
    .replace(/\u00b7/g, "|");
}

function money(value: number | null): string {
  if (value == null) return "No budget ask";
  return `$${value.toLocaleString("en-US")}`;
}

export function DecisionCard({
  decision,
  canAct,
}: {
  decision: Decision;
  canAct: boolean;
}) {
  const tone = outcomeTone(decision);
  const label = outcomeLabel(decision);
  const open = decision.status === "open";

  return (
    <article className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`mono rounded-card border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass(tone)}`}>
              {label}
            </span>
            {decision.auto_flag && (
              <span className="mono rounded-card border border-violet-soft bg-violet-soft px-2 py-1 text-[11px] font-semibold text-violet">
                Auto-flagged
              </span>
            )}
            {decision.priority?.toLowerCase() === "urgent" && (
              <span className="mono rounded-card border border-red-soft bg-red-soft px-2 py-1 text-[11px] font-semibold text-red">
                Urgent
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink">
            {clean(decision.question)}
          </h3>
        </div>
        <span className="mono num shrink-0 rounded-card border border-border bg-canvas px-2.5 py-1.5 text-[12px] font-semibold text-ink">
          {money(decision.budget_ask)}
        </span>
      </div>

      {decision.recommendation && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          <span className="font-semibold text-slate">Recommendation: </span>
          {clean(decision.recommendation)}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-4">
        <Field label="Workstream" value={clean(decision.workstream) || "—"} />
        <Field label="Raised by" value={clean(decision.raised_by) || "—"} />
        <Field label="Due" value={decision.due_date ?? "—"} />
        <Field label="Raised" value={decision.created_at.slice(0, 10)} />
      </dl>

      {!open && decision.response_note && (
        <div className="mt-3 rounded-card border border-hairline bg-canvas p-2.5">
          <p className="mono text-[10px] font-semibold text-label">Leadership note</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{clean(decision.response_note)}</p>
          {decision.resolved_at && (
            <p className="mono mt-1 text-[11px] text-label">Resolved {decision.resolved_at.slice(0, 10)}</p>
          )}
        </div>
      )}

      {open && canAct && <DecisionActions id={decision.id} />}
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mono text-[10px] font-semibold uppercase tracking-wide text-label">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px] font-medium text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}
