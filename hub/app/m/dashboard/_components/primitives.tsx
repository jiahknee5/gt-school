// Presentational primitives for the Dashboard sub-views. Server components reusing the
// global design tokens (globals.css) so the scorecard matches the rest of the Hub.

import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "watch" | "risk";

export function toneClass(tone: Tone = "neutral"): string {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
}

export function statusTone(status: "on_track" | "watch" | "at_risk"): Tone {
  if (status === "at_risk") return "risk";
  if (status === "watch") return "watch";
  return "good";
}

export function fmtValue(value: number, unit: "count" | "pct" | "ratio"): string {
  if (unit === "pct") return `${Number(value.toFixed(1))}%`;
  if (unit === "ratio") return value.toFixed(2);
  return Math.round(value).toLocaleString("en-US");
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

/** A tiny inline sparkline sharing a single baseline (Hannah: honest encoding). */
export function Sparkline({ values, tone = "neutral" }: { values: number[]; tone?: Tone }) {
  if (values.length === 0) return <span className="text-[11px] text-muted">no data</span>;
  const max = Math.max(...values, 1);
  const stroke = tone === "risk" ? "bg-red" : tone === "watch" ? "bg-amber" : tone === "good" ? "bg-green" : "bg-slate";
  return (
    <span className="inline-flex h-7 items-end gap-0.5" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-sm ${stroke}`}
          style={{ height: `${Math.max(8, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </span>
  );
}
