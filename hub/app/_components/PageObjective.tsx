// PageObjective — the objective-first banner that leads every module surface. It states
// WHAT the page is for and WHY it matters (the business outcome) BEFORE any KPI or table,
// so a brand-new user reads the page top-down: objective -> proof -> detail.
//
// Server component. Content comes from lib/help/explanations.ts (PAGE_OBJECTIVES), keyed by
// module slug, so the objective is written once and never restated elsewhere on the page.

import { pageObjective } from "@/lib/help/explanations";

export function PageObjective({ slug }: { slug: string }) {
  const o = pageObjective(slug);
  if (!o) return null;
  return (
    <section
      data-tour="tour-page-objective"
      aria-label="What this page is for"
      className="rounded-card border border-hairline bg-surface p-3 shadow-sm"
    >
      <div className="flex items-baseline gap-2">
        <span className="mono rounded-card border border-gold bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber">
          Objective
        </span>
        <p className="text-[12px] font-semibold leading-snug text-ink">{o.objective}</p>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        <span className="font-semibold text-slate">Why it matters:</span> {o.matters}
      </p>
    </section>
  );
}
