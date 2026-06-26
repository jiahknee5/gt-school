"use client";

// Launches the interactive product tour for a Help guide. Pulls the guide's steps
// from the single source of truth (lib/help/guides.ts) and hands them to useTour().
// Steps that carry a data-tour target spotlight a real element; the rest narrate.

import { guideBySlug } from "@/lib/help/guides";
import { useTour } from "./GuidedTour";

export function TourButton({
  slug,
  label = "Start product tour",
  className,
}: {
  slug: string;
  label?: string;
  className?: string;
}) {
  const { start } = useTour();
  const guide = guideBySlug(slug);
  if (!guide) return null;

  const live = guide.steps.some((s) => s.target);

  return (
    <button
      type="button"
      onClick={() =>
        start({
          slug: guide.slug,
          title: guide.title,
          steps: guide.steps.map((s) => ({
            do: s.do,
            where: s.where,
            result: s.result,
            why: s.why,
            href: s.href,
            target: s.target,
          })),
        })
      }
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-card border border-gold bg-fill px-2.5 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-gold hover:text-on-cta"
      }
    >
      <span aria-hidden>▷</span>
      {label}
      {live && (
        <span className="mono rounded-[4px] bg-ink-cta px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-on-cta">
          live
        </span>
      )}
    </button>
  );
}
