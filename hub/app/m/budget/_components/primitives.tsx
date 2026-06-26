// Shared presentational primitives for the Budget Tracker sub-views. Server components;
// reuse the global design tokens (globals.css) so Budget matches the rest of the Hub.

import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "watch" | "risk";

export function toneClass(tone: Tone = "neutral"): string {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
}

export function healthTone(health: "on-track" | "watch" | "at-risk"): Tone {
  if (health === "at-risk") return "risk";
  if (health === "watch") return "watch";
  return "good";
}

export function usd(value: number): string {
  const neg = value < 0;
  return `${neg ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

export function pct(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`mono w-fit rounded-card border px-2 py-1 text-[11px] font-semibold ${toneClass(tone)}`}>
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
    <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
        <div>
          <h2 className="font-serif text-[20px] font-semibold text-ink">{title}</h2>
          {note && <p className="mt-1 text-[13px] leading-relaxed text-muted">{note}</p>}
        </div>
        {right}
      </div>
      <div className="pt-3">{children}</div>
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
    <article className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
      <div className={`mono inline-flex rounded-card border px-2 py-1 text-[11px] font-semibold ${toneClass(tone)}`}>
        {label}
      </div>
      <p className="mono num mt-3 text-[26px] font-semibold leading-none text-ink">{value}</p>
      <p className="mt-2 text-[12px] leading-snug text-muted">{note}</p>
    </article>
  );
}

/** A simple horizontal bar (share-relative). */
export function Bar({ pct: width, tone = "neutral" }: { pct: number; tone?: Tone }) {
  const fill =
    tone === "risk" ? "bg-red" : tone === "watch" ? "bg-amber" : tone === "good" ? "bg-green" : "bg-slate";
  return (
    <div className="h-2 w-full rounded-full bg-fill">
      <div className={`h-2 rounded-full ${fill}`} style={{ width: `${Math.max(2, Math.min(100, width))}%` }} />
    </div>
  );
}
