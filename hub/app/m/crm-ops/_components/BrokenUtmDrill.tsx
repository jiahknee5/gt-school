// Broken-UTM drill-in — the EXACT records with (not set)/malformed source (Sofia).
// Carries family id + the broken source value only — no PII (Schwartz).

import type { AttributionSummary } from "@/lib/crm-ops/attribution";
import { Card, Pill } from "./primitives";

export function BrokenUtmDrill({ attribution }: { attribution: AttributionSummary }) {
  const { health, brokenSample } = attribution;
  return (
    <Card
      title="Broken-UTM drill-in"
      note={`${health.broken} of ${health.total} families have an unresolved source (UTM health ${health.healthPct}%). Showing ${brokenSample.length}.`}
      right={<Pill tone={health.broken === 0 ? "good" : "risk"}>{health.healthPct}% healthy</Pill>}
    >
      {brokenSample.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">No broken-UTM records — every family has a resolved source.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {brokenSample.map((r) => (
            <div key={r.familyId} className="grid gap-2 py-3 sm:grid-cols-[1fr_160px] sm:items-center">
              <div>
                <p className="mono text-[12px] font-semibold text-ink">family {r.familyId}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  source: <span className="mono">{r.source ?? "(not set)"}</span>
                  {r.utmCampaign ? ` · campaign ${r.utmCampaign}` : ""}
                </p>
              </div>
              <Pill tone="risk">{r.reason}</Pill>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
