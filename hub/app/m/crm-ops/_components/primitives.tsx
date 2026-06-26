// Shared presentational primitives for the CRM Ops sub-views. Server components;
// reuse the global design tokens (globals.css) so CRM Ops matches the rest of the Hub.

import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "watch" | "risk";

export function toneClass(tone: Tone = "neutral"): string {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`mono w-fit rounded-card border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

export function Card({
  title,
  note,
  children,
  right,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-hairline pb-2.5">
        <div>
          <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {note && <p className="mt-0.5 text-[11px] leading-snug text-muted">{note}</p>}
        </div>
        {right}
      </div>
      <div className="pt-2.5">{children}</div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: Tone;
}) {
  return (
    <article className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
      <div className={`mono inline-flex rounded-card border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass(tone)}`}>
        {label}
      </div>
      <p className="mono num mt-1.5 text-[18px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{note}</p>
    </article>
  );
}

/** A simple horizontal bar (count-relative), used for histograms. */
export function Bar({ pct, tone = "neutral" }: { pct: number; tone?: Tone }) {
  const fill =
    tone === "risk" ? "bg-red" : tone === "watch" ? "bg-amber" : tone === "good" ? "bg-green" : "bg-slate";
  return (
    <div className="h-2 w-full rounded-full bg-fill">
      <div className={`h-2 rounded-full ${fill}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}
