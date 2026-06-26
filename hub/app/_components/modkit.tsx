// modkit.tsx — shared presentational primitives for module surfaces (Nurture, Grassroots,
// Admissions, Content, Analytics, Summer Camp, Events, Library). One design vocabulary so
// every module reads as the same product (cohesion). Server components; global tokens.

import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_USERS } from "@/lib/phase2";

export type Tone = "neutral" | "good" | "watch" | "risk";

export function toneClass(tone: Tone = "neutral"): string {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
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
    <nav className="flex flex-wrap gap-1.5 rounded-card border border-hairline bg-surface p-1.5">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-card px-3 py-1.5 text-[12px] font-semibold transition-colors ${
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

/** The standard module page header with the dev role-lens switcher. */
export function ModuleHeader({
  moduleN,
  title,
  blurb,
  basePath,
  viewerName,
  viewerTitle,
  viewerRole,
  devMode,
}: {
  moduleN: number;
  title: string;
  blurb: string;
  basePath: string;
  viewerName: string;
  viewerTitle: string;
  viewerRole: string;
  devMode: boolean;
}) {
  const loginHref = (role: string) =>
    `/api/auth/login?role=${role}&next=${encodeURIComponent(basePath)}`;
  return (
    <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
      <div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-7 lg:px-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/" className="mono text-[11px] font-semibold text-gold hover:underline">
              Home
            </Link>
            <p className="mono mt-4 text-[11px] font-semibold text-label">Module {moduleN}</p>
            <h1 className="mt-1 font-serif text-[34px] font-semibold leading-tight text-ink">{title}</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-muted">{blurb}</p>
          </div>
          <div className="rounded-card border border-hairline bg-canvas p-3">
            <p className="mono text-[11px] font-semibold text-label">
              {devMode ? "Role lens (dev switcher)" : "Active role"}
            </p>
            {devMode && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEMO_USERS.map((user) => (
                  <a
                    key={user.id}
                    href={loginHref(user.role)}
                    className={`rounded-card border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                      viewerRole === user.role
                        ? "border-gold bg-amber-soft text-ink"
                        : "border-hairline bg-surface text-muted hover:border-border hover:text-ink"
                    }`}
                  >
                    {user.role}
                  </a>
                ))}
              </div>
            )}
            <p className="mt-2 text-[12px] text-muted">
              {viewerName} | {viewerTitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
