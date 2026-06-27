// Shared dual-citation affordance (WS4): two tiny links under/after a metric — one to the
// module that OWNS the number (▸ Module), one to its data source (⛁ Source → the
// Integrations dev surface, anchored to that connector). Used by the Dashboard scorecard
// and the Status metric contract so every metric traces to both its owner and its source.

import Link from "next/link";
import { moduleBySlug } from "@/lib/modules";
import { moduleCiteHref, sourceHref, sourceLabel } from "@/lib/metrics/citations";

export function MetricCite({
  source,
  homeModule,
  trailing,
  className = "",
}: {
  source: string;
  homeModule: string;
  /** Optional extra text (e.g. freshness age) shown muted after the links. */
  trailing?: string;
  className?: string;
}) {
  const mod = moduleBySlug(homeModule);
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] ${className}`}>
      <Link
        href={moduleCiteHref(homeModule)}
        className="mono text-slate hover:text-gold hover:underline"
        title={`Owned by the ${mod?.name ?? homeModule} module`}
      >
        ▸ {mod?.short ?? homeModule}
      </Link>
      <span className="text-muted/50" aria-hidden="true">·</span>
      <Link
        href={sourceHref(source)}
        className="mono text-slate hover:text-gold hover:underline"
        title={`Source: ${sourceLabel(source)} — open its connector on Integrations`}
      >
        ⛁ {sourceLabel(source)}
      </Link>
      {trailing ? <span className="text-muted">· {trailing}</span> : null}
    </span>
  );
}
