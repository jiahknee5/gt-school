// Overall parity score shown ALONGSIDE the worst field — the anti-vanity widget
// (Rahman #9, invariant #5): the ~98% can never hide a field at 60%.

import type { ParityView } from "@/lib/crm-ops/parity-view";
import { MetricTile, type Tone } from "./primitives";

export function ParityScore({
  parity,
  thresholdPct,
}: {
  parity: ParityView;
  thresholdPct: number;
}) {
  const overallTone: Tone = parity.overallPct >= thresholdPct ? "good" : "risk";
  const worst = parity.fieldDetail[0]; // asc by pct → worst first
  const worstBelow = worst ? worst.pct < thresholdPct : false;
  const worstTone: Tone = !worstBelow ? "good" : worst?.expectedUnreliable ? "watch" : "risk";

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <MetricTile
        label="Overall parity"
        value={`${parity.overallPct}%`}
        note={`${parity.inParityRows}/${parity.totalRows} field rows in parity · threshold ${thresholdPct}%`}
        tone={overallTone}
      />
      <MetricTile
        label="Worst field"
        value={worst ? `${worst.field} ${worst.pct}%` : "—"}
        note={
          worst
            ? worstBelow
              ? worst.expectedUnreliable
                ? "Below threshold but known-unreliable (calm)."
                : "Below threshold — unexpected drift. Investigate."
              : "All fields at or above threshold."
            : "No governed fields in scope."
        }
        tone={worstTone}
      />
      <MetricTile
        label="Below threshold"
        value={String(parity.fieldDetail.filter((f) => f.pct < thresholdPct).length)}
        note="Fields under the parity threshold (shown in the table below)."
        tone={parity.fieldDetail.some((f) => f.pct < thresholdPct) ? "watch" : "good"}
      />
    </div>
  );
}
