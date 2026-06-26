// 10d — Variance alerts. The list of workstreams that trip the >10% AND >= $2,500 rule,
// each with a deep-link to a PRE-FILLED reallocation decision in the Decision Queue
// (Rivera: a variance must lead to a logged decision, not just a red badge). The §4
// payload is shown so the auto-flag is auditable, and dedup status is explicit.

import Link from "next/link";
import type { Decision } from "@/lib/seed/types";
import {
  buildVariancePayload,
  evaluateVariance,
  reallocationDeepLink,
  VARIANCE_FLOOR,
  type VarianceInput,
} from "@/lib/budget/variance";
import { Card, Pill, usd } from "./primitives";

export function VarianceAlerts({
  rows,
  decisions,
  asOf,
}: {
  rows: VarianceInput[];
  decisions: Decision[];
  asOf: string;
}) {
  const variances = evaluateVariance(rows);
  const flagged = variances.filter((v) => v.flagged);
  const openAutoFlag = new Set(
    decisions.filter((d) => d.auto_flag && d.status === "open" && d.workstream).map((d) => d.workstream),
  );

  return (
    <Card
      title="Variance alerts"
      note={`Trigger: actual > planned x 1.10 AND at least ${usd(VARIANCE_FLOOR)} over (so small lines do not spam). Evaluated against planned.`}
      right={<Pill tone={flagged.length ? "risk" : "good"}>{flagged.length} flagged</Pill>}
    >
      {flagged.length === 0 ? (
        <p className="text-[11px] text-muted">
          All workstreams on-track — no line is more than 10% (and ${VARIANCE_FLOOR.toLocaleString("en-US")}) over plan.
        </p>
      ) : (
        <ul className="space-y-3">
          {flagged.map((v) => {
            const payload = buildVariancePayload(v, asOf);
            const alreadyOpen = openAutoFlag.has(v.key);
            return (
              <li key={v.key} className="rounded-card border border-hairline bg-canvas p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink">{v.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Pill tone={v.urgent ? "risk" : "watch"}>{v.urgent ? "urgent" : "normal"}</Pill>
                    <Pill tone={alreadyOpen ? "neutral" : "risk"}>
                      {alreadyOpen ? "auto-flag open" : "auto-flag pending"}
                    </Pill>
                  </div>
                </div>
                <p className="mt-1 text-[13px] text-slate">{payload.question}</p>
                <p className="mono mt-0.5 text-[11px] text-muted">
                  actual {usd(v.actual)} vs planned {usd(v.planned)} · {Math.round(v.overPct)}% over ({usd(v.overAmount)}) · ask {usd(payload.budget_ask ?? 0)} · due {payload.due_date}
                </p>
                <div className="mt-2">
                  <Link
                    href={reallocationDeepLink(v)}
                    className="inline-flex h-8 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px"
                  >
                    Open reallocation in Decision Queue
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Auto-flags are idempotent: one open Decision Queue item per workstream. An approved reallocation
        adjusts planned and clears the alert.
      </p>
    </Card>
  );
}
