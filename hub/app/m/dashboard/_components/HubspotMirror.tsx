// 6e HubSpot dashboard mirror — DISPLAY-ONLY, labeled. The mirrored widgets are NOT
// re-aggregated into a Hub KPI (Marcus vs Sam, resolved): a mirror value may differ
// from the canonical Hub scorecard value for the same concept, and that is expected
// and labeled — never silently reconciled (invariant #8).

import { Card, Pill } from "./primitives";

interface MirrorWidget {
  title: string;
  value: string;
  note: string;
}

const MIRROR_WIDGETS: MirrorWidget[] = [
  { title: "HubSpot · Contacts created (this wk)", value: "118", note: "HubSpot report — counts contacts, not app_form applicants" },
  { title: "HubSpot · Deals in 'Deposit'", value: "59", note: "HubSpot pipeline stage — may differ from Hub deposits" },
  { title: "HubSpot · MQL→SQL rate", value: "31%", note: "HubSpot lifecycle report (display only)" },
];

export function HubspotMirror() {
  return (
    <Card
      title="HubSpot dashboard mirror"
      note="Mirrored from HubSpot — display only. Not reconciled into any Hub KPI."
      right={<Pill tone="watch">display-only</Pill>}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {MIRROR_WIDGETS.map((w) => (
          <article key={w.title} className="rounded-card border border-hairline bg-canvas p-2.5">
            <p className="text-[12px] font-semibold text-ink">{w.title}</p>
            <p className="mono num mt-1.5 text-[18px] font-bold text-ink">{w.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{w.note}</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        A mirror value differing from the Hub scorecard for the same concept is expected — the Hub KPI reads
        its home-module source of truth; the mirror is a convenience copy of HubSpot&apos;s own report.
      </p>
    </Card>
  );
}
