// Attribution chain viz — form to Supabase app_form to HubSpot, status PER HOP, naming
// the HubSpot property the source maps to (Sofia's falsifiable ask). The red hop is
// diagnosable, not a vibe.

import type { AttributionSummary, HopStatus } from "@/lib/crm-ops/attribution";
import { Card, Pill, type Tone } from "./primitives";

function hopTone(status: HopStatus): Tone {
  if (status === "ok") return "good";
  if (status === "degraded") return "watch";
  return "risk";
}

export function AttributionChain({ attribution }: { attribution: AttributionSummary }) {
  return (
    <Card
      title="Attribution chain"
      note={`form to Supabase app_form to HubSpot. The source field mirrors HubSpot '${attribution.hsProperty}'.`}
    >
      <ol className="space-y-2">
        {attribution.chain.map((hop) => (
          <li
            key={hop.step}
            className="grid gap-2 rounded-card border border-hairline bg-canvas p-3 sm:grid-cols-[24px_1fr_120px] sm:items-center"
          >
            <span className="mono grid h-6 w-6 place-items-center rounded-full bg-fill text-[11px] font-semibold text-slate">
              {hop.step}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink">
                {hop.hop} <span className="mono text-[11px] text-label">({hop.system})</span>
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                <span className="mono">{hop.field}</span> — {hop.detail}
              </p>
            </div>
            <Pill tone={hopTone(hop.status)}>{hop.status}</Pill>
          </li>
        ))}
      </ol>
    </Card>
  );
}
