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
  // Dense single strip: the objective inline; "why it matters" folds into the hover title
  // so it stays one line and never pushes the real content below the fold (Q1/Q9 density).
  return (
    <section
      data-tour="tour-page-objective"
      aria-label="What this page is for"
      title={`Why it matters: ${o.matters}`}
      className="flex items-baseline gap-2 rounded-card border border-hairline bg-surface px-2.5 py-1.5 shadow-sm"
    >
      <span className="mono shrink-0 rounded-card border border-gold bg-amber-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber">
        Objective
      </span>
      <p className="truncate text-[12px] font-semibold leading-snug text-ink" title={o.objective}>
        {o.objective}
      </p>
    </section>
  );
}
