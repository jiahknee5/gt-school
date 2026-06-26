"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

export function TopBar({
  viewer,
  devMode,
}: {
  viewer: TopBarViewer | null;
  devMode: boolean;
}) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const isHome = pathname === "/";
  const days = useMemo(() => daysToCutoff(), []);
  const visibleModules = MODULES.filter((module) => !module.leaderOnly || viewer?.role === "leader");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-topbar/95 backdrop-blur">
      <div className="flex min-h-[58px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" title="GT School Marketing Hub">
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

        <div className="hidden h-7 w-px bg-hairline lg:block" />

        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <p className="mono text-[11px] font-semibold uppercase tracking-[0.1em] text-label">
            Week of
          </p>
          <select className="h-8 rounded-card border border-border bg-canvas px-2 text-[12px] font-semibold text-ink">
            <option>Jun 29, 2026</option>
            <option>Jul 6, 2026</option>
            <option>Jul 13, 2026</option>
          </select>
          <span className="mono rounded-card bg-fill px-2 py-1 text-[11px] font-semibold text-slate">
            {days} days to cutoff
          </span>
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
        <p className="mono shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
          Week of
        </p>
        <select className="h-8 shrink-0 rounded-card border border-border bg-canvas px-2 text-[12px] font-semibold text-ink">
          <option>Jun 29, 2026</option>
          <option>Jul 6, 2026</option>
          <option>Jul 13, 2026</option>
        </select>
        <span className="mono shrink-0 rounded-card bg-fill px-2 py-1 text-[11px] font-semibold text-slate">
          {days} days to cutoff
        </span>
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
