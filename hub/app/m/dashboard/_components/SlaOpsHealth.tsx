// 6c SLA & ops health — connector freshness + the tracking-gaps register. The register
// reads the CRM Ops data-quality issues (UTM broken, event-to-consult uninstrumented,
// parity dip) so the board is HONEST about what it cannot measure (Rahman/Dana).

import type { SeedDataset } from "@/lib/seed/types";
import { connectorFreshness, humanizeAge } from "@/lib/dashboard/freshness";
import { Card, Pill } from "./primitives";

export function SlaOpsHealth({ ds }: { ds: SeedDataset }) {
  const fresh = connectorFreshness(ds);
  const gaps = ds.data_quality_issue.filter(
    (i) => i.status === "open" && (i.category === "utm" || i.category === "tracking" || i.category === "sync"),
  );
  return (
    <div className="space-y-4">
      <Card title="Connector freshness" note="Each scorecard row inherits its source connector's last-sync. Stale-but-green is a lie.">
        <div className="grid gap-2 sm:grid-cols-2">
          {fresh.map((c) => (
            <div key={c.connector} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2">
              <div>
                <p className="text-[13px] font-semibold text-ink">{c.connector}</p>
                <p className="text-[11px] text-muted">
                  last sync {humanizeAge(c.ageMinutes)} · SLA {c.freshnessSlaMinutes}m
                </p>
              </div>
              <Pill tone={c.status === "stale" ? "risk" : "good"}>{c.status}</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tracking-gaps register" note="Known measurement gaps — surfaced, not hidden behind a green number.">
        {gaps.length ? (
          <ul className="divide-y divide-hairline">
            {gaps.map((g) => (
              <li key={g.id} className="flex items-start justify-between gap-3 py-2.5">
                <p className="text-[13px] leading-snug text-ink">{g.description}</p>
                <Pill tone={g.severity === "high" ? "risk" : g.severity === "medium" ? "watch" : "neutral"}>
                  {g.severity}
                </Pill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-[13px] text-green">No open tracking gaps.</p>
        )}
      </Card>
    </div>
  );
}
