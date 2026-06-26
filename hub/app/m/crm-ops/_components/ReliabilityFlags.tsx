// Field-reliability flags — derived from field_authority.expected_unreliable (via the
// seeded SYNCED_FIELDS), NEVER a hardcoded list (Wu's falsifiable ask). Flip a seed
// flag and the flag here flips with no code change.

import { SYNCED_FIELDS } from "@/lib/seed/dictionaries";
import type { FieldParityView } from "@/lib/crm-ops/parity-view";
import { Card, Pill } from "./primitives";

export function ReliabilityFlags({ fieldDetail }: { fieldDetail: FieldParityView[] }) {
  const pctByField = new Map(fieldDetail.map((f) => [f.field, f.pct]));
  const unreliable = SYNCED_FIELDS.filter((f) => f.unreliable);

  return (
    <Card
      title="Field reliability"
      note="Known-unreliable HubSpot fields are named, not hidden. This list reads field_authority.expected_unreliable."
    >
      <div className="divide-y divide-hairline">
        {unreliable.map((f) => {
          const pct = pctByField.get(f.field);
          return (
            <div key={f.field} className="grid gap-2 py-3 sm:grid-cols-[1fr_120px] sm:items-center">
              <div>
                <p className="mono text-[12px] font-semibold text-ink">{f.field}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  authority: {f.authority} · expected_unreliable: true
                </p>
              </div>
              <Pill tone="watch">{pct != null ? `${pct}%` : "in scope"}</Pill>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
