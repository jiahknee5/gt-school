"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { MODULES, moduleHref } from "@/lib/modules";
import { modulesForNavScope, type NavScope } from "@/lib/nav";
import { type FunctionalRole, type Role } from "@/lib/phase2";
import { BrandLogo } from "./BrandLogo";
import { HomeWidgetPicker } from "./HomeWidgetPicker";

export type TopBarViewer = {
  id: string;
  name: string;
  title: string;
  role: Role;
  functionalRoles: FunctionalRole[];
  ownsModules: string[];
};

function daysToCutoff() {
  const cutoff = new Date("2026-08-17T00:00:00-05:00").getTime();
  return Math.max(0, Math.ceil((cutoff - Date.now()) / 86_400_000));
}

function formatWeekLabel(week: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${week}T00:00:00.000Z`));
}

function WeekContextControl({
  compact = false,
  days,
  pacingHref,
  onChange,
  selectedWeek,
  weeks,
}: {
  compact?: boolean;
  days: number;
  pacingHref: string;
  onChange: (week: string) => void;
  selectedWeek: string;
  weeks: string[];
}) {
  const controlId = useId();
  const helpId = `${controlId}-help`;
  const selectId = `${controlId}-select`;
  const helpText =
    "Sets the Monday-starting week for shared Home widgets and the Dashboard scorecard. The URL keeps ?week= so meeting links are shareable. Module calendars and local date filters keep their own ranges.";

  return (
    <div
      data-tour={compact ? undefined : "tour-week-selector"}
      className={`relative flex shrink-0 items-center gap-2 ${compact ? "" : "min-w-0"}`}
    >
      <label
        htmlFor={selectId}
        className="mono shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-label"
      >
        Reporting week
      </label>
      <select
        id={selectId}
        aria-label="Reporting week, Monday start"
        aria-describedby={helpId}
        value={selectedWeek}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        className="h-8 shrink-0 rounded-card border border-border bg-canvas px-2 text-[12px] font-semibold text-ink"
      >
        {weeks.map((week) => (
          <option key={week} value={week}>
            {formatWeekLabel(week)}
          </option>
        ))}
      </select>
      <Link
        href={pacingHref}
        className={`mono shrink-0 rounded-card px-2 py-1 text-[11px] font-semibold transition-colors ${
          days < 14
            ? "bg-amber-soft text-amber hover:opacity-80"
            : "bg-fill text-slate hover:text-ink"
        }`}
        title={`Fall 2026 enrollment deadline is August 17. ${days} ${
          days === 1 ? "day" : "days"
        } left. Opens the Dashboard goal-pacing view.`}
      >
        <span className="hidden sm:inline">
          {days} {days === 1 ? "day" : "days"} to Fall enrollment (Aug 17)
        </span>
        <span className="sm:hidden">{days}d to Aug 17</span>
      </Link>
      <button
        type="button"
        aria-label="How reporting week is used"
        aria-describedby={helpId}
        className="peer grid h-6 w-6 shrink-0 place-items-center rounded-full border border-hairline bg-canvas text-[11px] font-bold text-muted outline-none transition-colors hover:text-ink focus:text-ink focus:ring-2 focus:ring-gold/40"
      >
        i
      </button>
      <span
        id={helpId}
        role="tooltip"
        className={`invisible z-50 rounded-card border border-hairline bg-surface p-3 text-[11px] leading-snug text-muted opacity-0 shadow-lg transition-opacity hover:visible hover:opacity-100 peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100 ${
          compact
            ? "fixed left-3 right-3 top-[104px]"
            : "absolute left-0 top-[calc(100%+8px)] w-[310px]"
        }`}
      >
        <span className="block font-semibold text-ink">Reporting week</span>
        <span className="mt-1 block">{helpText}</span>
      </span>
    </div>
  );
}

export function TopBar({
  viewer,
  devMode,
  navScope = "my",
}: {
  viewer: TopBarViewer | null;
  devMode: boolean;
  navScope?: NavScope;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dark, setDark] = useState(false);
  const isHome = pathname === "/";
  const days = useMemo(() => daysToCutoff(), []);
  const weeks = useMemo(() => weekMondays(), []);
  const selectedWeek =
    searchParams.get("week") && weeks.includes(searchParams.get("week") ?? "")
      ? searchParams.get("week") ?? defaultReportingWeek()
      : defaultReportingWeek();
  const explicitWeek = searchParams.get("week");
  const scopedWeek = explicitWeek && weeks.includes(explicitWeek) ? explicitWeek : null;
  const rbacModules = MODULES.filter((module) => !module.leaderOnly || viewer?.role === "leader");
  const visibleModules = viewer
    ? modulesForNavScope(rbacModules, viewer, navScope)
    : rbacModules;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function setReportingWeek(week: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", week);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function reportingHref(href: string): string {
    if (!scopedWeek || (href !== "/" && href !== "/m/dashboard")) return href;
    return `${href}?week=${encodeURIComponent(scopedWeek)}`;
  }

  const pacingHref = scopedWeek
    ? `/m/dashboard?tab=pacing&week=${encodeURIComponent(scopedWeek)}`
    : "/m/dashboard?tab=pacing";

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-topbar/95 backdrop-blur">
      <div className="flex min-h-[58px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={reportingHref("/")}
          aria-label="GT School Marketing Hub home"
          className="flex shrink-0 items-center gap-2.5 lg:hidden"
          title="GT School Marketing Hub"
        >
          <BrandLogo className="h-7 w-[122px] sm:h-8 sm:w-[139px]" priority />
          <span className="hidden h-6 w-px bg-hairline sm:block" />
          <span className="hidden text-[13px] font-semibold text-muted sm:inline">Marketing Hub</span>
        </Link>

        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <WeekContextControl
            days={days}
            pacingHref={pacingHref}
            onChange={setReportingWeek}
            selectedWeek={selectedWeek}
            weeks={weeks}
          />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {isHome && (
            <HomeWidgetPicker
              key={`${viewer?.id ?? "anonymous"}:${viewer?.role ?? "none"}`}
              viewer={viewer}
            />
          )}

          {viewer ? (
            <Link
              href="/profile"
              title={
                devMode
                  ? "Your profile — view your role and switch role (dev)"
                  : "Your profile"
              }
              className="hidden min-w-0 rounded-card px-1.5 py-1 transition-colors hover:bg-hover sm:block"
            >
              <p className="truncate text-right text-[12px] font-semibold text-ink">{viewer.name}</p>
              <p className="mono truncate text-right text-[10px] text-label">
                {viewer.title}
                {devMode ? ` · ${viewer.role}` : ""}
              </p>
            </Link>
          ) : (
            <Link
              href="/login"
              prefetch={false}
              className="hidden rounded-card border border-border bg-canvas px-2.5 py-1.5 text-[12px] font-semibold text-ink sm:block"
            >
              Sign in
            </Link>
          )}

          <button
            type="button"
            aria-pressed={dark}
            onClick={() => setDark((v) => !v)}
            className="h-8 rounded-card border border-border bg-canvas px-2.5 text-[12px] font-semibold text-ink transition-transform active:translate-y-px"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-hairline px-3 py-2 lg:hidden">
        <WeekContextControl
          compact
          days={days}
          pacingHref={pacingHref}
          onChange={setReportingWeek}
          selectedWeek={selectedWeek}
          weeks={weeks}
        />
        {viewer && (
          <Link
            href="/profile"
            title={devMode ? "Your profile — switch role (dev)" : "Your profile"}
            className="mono shrink-0 rounded-card px-1.5 py-0.5 text-[10px] text-label hover:bg-hover"
          >
            {viewer.name}
            {devMode ? ` · ${viewer.role}` : ""}
          </Link>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-2 lg:hidden">
        {visibleModules.map((module) => {
          const active = module.slug === "home" ? pathname === "/" : pathname === moduleHref(module.slug);
          const href = moduleHref(module.slug);
          return (
            <Link
              key={module.slug}
              href={reportingHref(href)}
              className={`shrink-0 rounded-card px-2.5 py-1.5 text-[12px] font-semibold ${
                active ? "bg-ink-cta text-on-cta" : "bg-canvas text-muted"
              }`}
            >
              {module.short}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
