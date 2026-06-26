// Per-field parity table, worst-first. Below-threshold fields are flagged; a
// known-unreliable field reads CALM (amber) while a surprise reads RED (invariant #5/#2).

import type { FieldParityView } from "@/lib/crm-ops/parity-view";
import { Card, Pill, type Tone } from "./primitives";

export function FieldParityTable({
  fieldDetail,
  thresholdPct,
}: {
  fieldDetail: FieldParityView[];
  thresholdPct: number;
}) {
  return (
    <Card
      title="Sync parity by field"
      note={`Recomputed from field_state (normalize(app) === normalize(hs)). Threshold ${thresholdPct}%.`}
    >
      <div className="divide-y divide-hairline">
        {fieldDetail.map((f) => {
          const below = f.pct < thresholdPct;
          const tone: Tone = !below ? "good" : f.expectedUnreliable ? "watch" : "risk";
          const status = !below
            ? "in parity"
            : f.expectedUnreliable
              ? "below (known-unreliable)"
              : "below (surprise)";
          return (
            <div key={f.field} className="grid gap-2 py-3 sm:grid-cols-[1fr_120px_120px] sm:items-center">
              <div>
                <p className="mono text-[12px] font-semibold text-ink">{f.field}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  {f.inParity}/{f.total} rows in parity · {status}
                </p>
              </div>
              <Pill tone={tone}>{f.pct}%</Pill>
              <span className="mono text-[11px] text-label sm:justify-self-end">
                {f.expectedUnreliable ? "expected_unreliable" : "governed"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
