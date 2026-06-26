/**
 * DataConfidenceBanner — the SHARED data-confidence banner OWNED by Module 7 (CRM Ops).
 *
 * THE CONTRACT (PRD §4 broadcast). This component is the single rendering of the
 * banner; every HubSpot-consuming module mounts it and links back to /m/crm-ops. The
 * banner state is a READ of CRM Ops' parity engine — consumers must NEVER recompute
 * parity locally (Park #6). The source of truth is, in order:
 *   - live:  `getBannerState()` from `lib/parity.ts` (reads the latest parity_snapshot)
 *   - seed:  `seedBannerState(field_state)` from `lib/crm-ops/parity-view.ts` (its pure twin)
 * Both return the same shape; pass it in via the `state` prop.
 *
 * SEMANTICS: `alarm` is true IFF a non-expected_unreliable field is below threshold (a
 * SURPRISE → red). Known-unreliable fields (TEFA/income/source) report their true % but
 * render CALM (amber) and do not trip the alarm.
 *
 * CONSUMERS (render this; link to Module 7): M1 Home, M2 Grassroots, M3 Content,
 * M5 Nurture, M6 Dashboard, M9 Admissions. NON-consumers (manual/GA4/site sources) do
 * NOT show it: M4 Summer Camp, M8 Events, M10 Budget, M11 Decisions, M12 Library,
 * M13 Analytics. (The existing /m/[slug] surface renders an inline banner today; new
 * surfaces should mount THIS component so the contract has one implementation.)
 */

import Link from "next/link";

export interface BannerFieldLike {
  field: string;
  pct: number;
  expectedUnreliable: boolean;
}

export interface BannerStateLike {
  overallPct: number;
  thresholdPct: number;
  below: BannerFieldLike[];
  surprises: string[];
  alarm: boolean;
}

function cleanCopy(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "to")
    .replace(/\u2248/g, "about")
    .replace(/\u00b7/g, "|");
}

export function DataConfidenceBanner({
  state,
  href = "/m/crm-ops",
}: {
  state: BannerStateLike;
  href?: string;
}) {
  // Nothing below threshold → no banner (healthy).
  if (state.below.length === 0) return null;

  const alarm = state.alarm;
  const fieldText = state.below
    .map((f) => `${f.field} ${f.pct}%${f.expectedUnreliable ? " (known-unreliable)" : " (surprise)"}`)
    .join(", ");
  const message = alarm
    ? `A field dropped unexpectedly below ${state.thresholdPct}%: ${fieldText}. Overall ${state.overallPct}%.`
    : `Known-unreliable fields are below ${state.thresholdPct}% (expected): ${fieldText}. Overall ${state.overallPct}%.`;

  const tone = alarm
    ? "border-red-soft bg-red-soft"
    : "border-gold bg-amber-soft";
  const headColor = alarm ? "text-red" : "text-ink";

  return (
    <section
      role={alarm ? "alert" : "status"}
      className={`rounded-card border ${tone} p-4`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`text-[14px] font-semibold ${headColor}`}>
            {alarm ? "Data confidence alarm" : "Data confidence warning"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate">{cleanCopy(message)}</p>
        </div>
        <Link
          href={href}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px"
        >
          Open CRM Ops
        </Link>
      </div>
    </section>
  );
}
