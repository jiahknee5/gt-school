// modkit.tsx — shared presentational primitives for module surfaces (Nurture, Grassroots,
// Admissions, Content, Analytics, Summer Camp, Events, Library). One design vocabulary so
// every module reads as the same product (cohesion). Server components; global tokens.

import Link from "next/link";
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

export function Bar({ pct, tone = "neutral" }: { pct: number; tone?: Tone }) {
  const fill = tone === "risk" ? "bg-red" : tone === "watch" ? "bg-amber" : tone === "good" ? "bg-green" : "bg-slate";
  return (
    <div className="h-2 w-full rounded-full bg-fill">
      <div className={`h-2 rounded-full ${fill}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  hrefFor,
}: {
  tabs: readonly { key: T; label: string }[];
  active: T;
  hrefFor: (key: T) => string;
}) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-card border border-hairline bg-surface p-1">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-card px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              isActive ? "bg-ink-cta text-on-cta shadow-sm" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The standard module page header. Role switching lives in the global TopBar; this
 * header shows the signed-in identity as read-only context only. */
export function ModuleHeader({
  moduleN,
  title,
  blurb,
  viewerName,
  viewerTitle,
  viewerRole,
}: {
  moduleN: number;
  title: string;
  blurb: string;
  viewerName: string;
  viewerTitle: string;
  viewerRole: string;
  /** Deprecated: role switching moved to the global TopBar. Kept for old call sites. */
  basePath?: string;
  /** Deprecated: role switching moved to the global TopBar. Kept for old call sites. */
  devMode?: boolean;
}) {
  return (
    <section data-tour="tour-module-overview" className="border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
                Home
              </Link>
              <span className="text-label">/</span>
              <span className="mono rounded-card border border-hairline bg-fill px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate">
                Module {moduleN}
              </span>
              <span className="mono rounded-card border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                {viewerTitle}
              </span>
            </div>
            <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
            <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">{blurb}</p>
          </div>
          <div className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
            <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
              Active role
            </p>
            <p className="mt-1 text-[12px] font-semibold text-ink">
              {viewerName}
            </p>
            <p className="mono mt-0.5 text-[10px] text-label">
              {viewerRole} | {viewerTitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
