"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { MODULES, moduleHref } from "@/lib/modules";
import { DEMO_USERS, type Role } from "@/lib/phase2";
import { HomeWidgetPicker } from "./HomeWidgetPicker";

export type TopBarViewer = {
  id: string;
  name: string;
  title: string;
  role: Role;
};

function daysToCutoff() {
  const cutoff = new Date("2026-08-17T00:00:00-05:00").getTime();
  return Math.max(0, Math.ceil((cutoff - Date.now()) / 86_400_000));
}

// Dev role switcher: minting a real signed session via the login route (server-side),
// not a spoofable ?role= query param.
function switchRoleHref(pathname: string, role: string) {
  return `/api/auth/login?role=${role}&next=${encodeURIComponent(pathname)}`;
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
  onChange,
  selectedWeek,
  weeks,
}: {
  compact?: boolean;
  days: number;
  onChange: (week: string) => void;
  selectedWeek: string;
  weeks: string[];
}) {
  const controlId = useId();
  const helpId = `${controlId}-help`;
  const selectId = `${controlId}-select`;
  const helpText =
    "Choose the Monday-starting reporting week used by the Dashboard scorecard, Home widgets, and week-aware recommendations. Module calendars can still use their own date filters.";

  return (
    <div
      data-tour={compact ? undefined : "tour-week-selector"}
      className={`group relative flex shrink-0 items-center gap-2 ${compact ? "" : "min-w-0"}`}
    >
      <label
        htmlFor={selectId}
        className="mono shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-label"
      >
        Week of
      </label>
      <select
        id={selectId}
        aria-describedby={helpId}
        value={selectedWeek}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        title={helpText}
        className="h-8 shrink-0 rounded-card border border-border bg-canvas px-2 text-[12px] font-semibold text-ink"
      >
        {weeks.map((week) => (
          <option key={week} value={week}>
            {formatWeekLabel(week)}
          </option>
        ))}
      </select>
      <span
        className="mono shrink-0 rounded-card bg-fill px-2 py-1 text-[11px] font-semibold text-slate"
        title="Days remaining until the August 17 Fall enrollment cutoff."
      >
        {days} days to cutoff
      </span>
      <span
        tabIndex={0}
        aria-label="How the weekly reporting selector is used"
        aria-describedby={helpId}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-hairline bg-canvas text-[11px] font-bold text-muted outline-none transition-colors hover:text-ink focus:text-ink focus:ring-2 focus:ring-gold/40"
      >
        i
      </span>
      <span
        id={helpId}
        role="tooltip"
        className={`pointer-events-none invisible z-50 rounded-card border border-hairline bg-surface p-3 text-[11px] leading-snug text-muted opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          compact
            ? "fixed left-3 right-3 top-[104px]"
            : "absolute left-0 top-[calc(100%+8px)] w-[310px]"
        }`}
      >
        <span className="block font-semibold text-ink">Weekly reporting context</span>
        <span className="mt-1 block">{helpText}</span>
      </span>
    </div>
  );
}

export function TopBar({
  viewer,
  devMode,
}: {
  viewer: TopBarViewer | null;
  devMode: boolean;
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
  const visibleModules = MODULES.filter((module) => !module.leaderOnly || viewer?.role === "leader");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function setReportingWeek(week: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", week);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-topbar/95 backdrop-blur">
      <div className="flex min-h-[58px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden" title="GT School Marketing Hub">
          <Image
            src="/gt-icon.svg"
            alt="GT School"
            width={28}
            height={28}
            priority
            unoptimized
            className="h-7 w-7"
          />
          <span className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-semibold text-ink">GT School</span>
            <span className="hidden text-[13px] font-medium text-muted sm:inline">Marketing Hub</span>
          </span>
        </Link>

        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <WeekContextControl
            days={days}
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

          {devMode && (
            <div
              className="flex items-center rounded-card border border-hairline bg-canvas p-0.5"
              title="Dev role switcher — starts a real server-enforced session"
            >
              {DEMO_USERS.map((user) => (
                <a
                  key={user.id}
                  href={switchRoleHref(pathname, user.role)}
                  className={`rounded-[6px] px-2.5 py-1 text-[11px] font-semibold ${
                    viewer?.role === user.role
                      ? "bg-ink-cta text-on-cta"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {user.role}
                </a>
              ))}
            </div>
          )}

          {viewer ? (
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-right text-[12px] font-semibold text-ink">{viewer.name}</p>
              <p className="mono truncate text-right text-[10px] text-label">{viewer.title}</p>
            </div>
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
          onChange={setReportingWeek}
          selectedWeek={selectedWeek}
          weeks={weeks}
        />
        {viewer && (
          <span className="mono shrink-0 text-[10px] text-label">
            {viewer.name}
          </span>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-2 lg:hidden">
        {visibleModules.map((module) => {
          const active = module.slug === "home" ? pathname === "/" : pathname === moduleHref(module.slug);
          return (
            <Link
              key={module.slug}
              href={moduleHref(module.slug)}
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
