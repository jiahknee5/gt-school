"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { weekMondays } from "@/lib/metrics/registry";
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
  const searchParams = useSearchParams();
  const [dark, setDark] = useState(false);
  const isHome = pathname === "/";
  const weeks = useMemo(() => weekMondays(), []);
  const explicitWeek = searchParams.get("week");
  const scopedWeek = explicitWeek && weeks.includes(explicitWeek) ? explicitWeek : null;
  const rbacModules = MODULES.filter((module) => !module.leaderOnly || viewer?.role === "leader");
  const visibleModules = viewer
    ? modulesForNavScope(rbacModules, viewer, navScope)
    : rbacModules;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function reportingHref(href: string): string {
    if (!scopedWeek || (href !== "/" && href !== "/m/dashboard")) return href;
    return `${href}?week=${encodeURIComponent(scopedWeek)}`;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-topbar/95 backdrop-blur">
      <div className="flex min-h-[58px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={reportingHref("/")}
          aria-label="GT School Marketing Hub home"
          className="flex shrink-0 items-center gap-2.5"
          title="GT School Marketing Hub"
        >
          <BrandLogo className="h-7 w-[122px] sm:h-8 sm:w-[139px]" priority />
          <span className="hidden h-6 w-px bg-hairline sm:block" />
          <span className="hidden text-[13px] font-semibold text-muted sm:inline">Marketing Hub</span>
        </Link>

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
              className="min-w-0 rounded-card px-1.5 py-1 transition-colors hover:bg-hover"
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
              className="rounded-card border border-border bg-canvas px-2.5 py-1.5 text-[12px] font-semibold text-ink"
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
