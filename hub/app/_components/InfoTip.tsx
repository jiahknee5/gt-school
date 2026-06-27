"use client";

// InfoTip — the one accessible hover/focus explanation affordance for the whole Hub.
// A small branded "?" trigger that, on hover OR keyboard focus OR tap, reveals a
// plain-language description tied to the page's business objective. Drop it next to any
// metric, column header, control, or section title that isn't self-evident.
//
// Accessibility: the trigger is a real <button> (keyboard-focusable, tappable), labelled
// for screen readers and wired to the tip via aria-describedby. The tip text is ALWAYS in
// the DOM (visually hidden until shown) so assistive tech and SSR/tests can read it. Hover
// and keyboard focus are handled with CSS group state; tap is handled with a pinned state.
//
// Content lives in lib/help/explanations.ts — prefer <Explain k="..."/> over inline text so
// every description is written once and stays consistent across pages.

import { useId, useState } from "react";
import { EXPLANATIONS, type ExplanationKey } from "@/lib/help/explanations";

export type InfoTipSide = "top" | "bottom";

export function InfoTip({
  label,
  text,
  side = "top",
  className = "",
}: {
  /** What is being explained — used for the screen-reader button label. */
  label: string;
  /** The plain-language explanation shown in the tip. */
  text: string;
  /** Which side of the trigger the tip opens on. */
  side?: InfoTipSide;
  /** Extra classes on the wrapper (e.g. alignment tweaks). */
  className?: string;
}) {
  const id = useId();
  const [pinned, setPinned] = useState(false);

  const pos =
    side === "bottom"
      ? "top-full mt-1.5"
      : "bottom-full mb-1.5";

  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-describedby={id}
        aria-expanded={pinned}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPinned(false);
        }}
        className="mono inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-hairline bg-fill text-[9px] font-bold leading-none text-slate transition-colors hover:border-gold hover:bg-hover hover:text-ink focus-visible:border-gold"
      >
        <span aria-hidden="true">?</span>
      </button>
      <span
        role="tooltip"
        id={id}
        className={`invisible absolute ${pos} left-1/2 z-50 w-56 -translate-x-1/2 rounded-card border border-border bg-surface px-2.5 py-1.5 text-left text-[11px] font-normal leading-snug text-slate opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          pinned ? "!visible !opacity-100" : ""
        }`}
      >
        {text}
      </span>
    </span>
  );
}

/** Convenience: render an InfoTip from a centralized explanations.ts key. */
export function Explain({ k, side, className }: { k: ExplanationKey; side?: InfoTipSide; className?: string }) {
  const e = EXPLANATIONS[k];
  return <InfoTip label={e.label} text={e.text} side={side} className={className} />;
}
