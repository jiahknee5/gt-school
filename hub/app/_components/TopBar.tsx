"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MODULES, moduleHref } from "@/lib/modules";
import { DEMO_USERS, WIDGET_LIBRARY, type Role } from "@/lib/phase2";

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
  const [addOpen, setAddOpen] = useState(false);
  const [widgetFilter, setWidgetFilter] = useState("");
  const isHome = pathname === "/";
  const days = useMemo(() => daysToCutoff(), []);
  const visibleModules = MODULES.filter((module) => !module.leaderOnly || viewer?.role === "leader");
  const widgetGroups = useMemo(() => {
    const q = widgetFilter.trim().toLowerCase();
    const groups = new Map<string, typeof WIDGET_LIBRARY>();
    for (const widget of WIDGET_LIBRARY) {
      const haystack = `${widget.label} ${widget.category} ${widget.source} ${widget.size}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;
      const rows = groups.get(widget.category) ?? [];
      rows.push(widget);
      groups.set(widget.category, rows);
    }
    return [...groups.entries()];
  }, [widgetFilter]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-topbar/95 backdrop-blur">
      <div className="flex min-h-[58px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-card bg-gold text-[12px] font-bold text-white">
            GT
          </span>
          <span className="text-[14px] font-semibold text-ink">Marketing Hub</span>
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
            <div className="relative">
              <button
                type="button"
                aria-expanded={addOpen}
                aria-controls="home-widget-picker"
                onClick={() => setAddOpen((value) => !value)}
                className="inline-flex h-8 items-center rounded-card bg-gold px-2.5 text-[12px] font-semibold text-white transition-transform active:translate-y-px sm:px-3"
              >
                <span className="sm:hidden">+ Widget</span>
                <span className="hidden sm:inline">+ Add widget</span>
              </button>
              {addOpen && (
                <div
                  id="home-widget-picker"
                  className="absolute right-0 top-10 z-50 w-[92vw] max-w-[420px] rounded-card border border-border bg-surface p-3 shadow-lg sm:w-[420px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">Add widgets</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Search the PRD widget library by name, category, or source.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddOpen(false)}
                      className="h-8 shrink-0 rounded-card border border-border bg-canvas px-2.5 text-[12px] font-semibold text-ink transition-transform active:translate-y-px"
                    >
                      Done
                    </button>
                  </div>

                  <label htmlFor="home-widget-search" className="sr-only">
                    Search widgets
                  </label>
                  <input
                    id="home-widget-search"
                    value={widgetFilter}
                    onChange={(event) => setWidgetFilter(event.target.value)}
                    placeholder="Search widgets"
                    className="mt-3 h-9 w-full rounded-card border border-border bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-label focus:border-gold"
                  />

                  <div className="mt-3 max-h-[60dvh] space-y-3 overflow-y-auto pr-1">
                    {widgetGroups.length === 0 ? (
                      <p className="rounded-card border border-hairline bg-canvas p-3 text-[12px] text-muted">
                        No widgets match that search.
                      </p>
                    ) : (
                      widgetGroups.map(([category, widgets]) => (
                        <div key={category}>
                          <p className="mono mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                            {category}
                          </p>
                          <div className="space-y-1">
                            {widgets.map((widget) => (
                              <label
                                key={widget.id}
                                className="flex cursor-pointer items-start gap-2 rounded-card border border-hairline bg-canvas p-2.5 hover:border-border hover:bg-hover"
                              >
                                <input
                                  type="checkbox"
                                  defaultChecked={Boolean(widget.starter)}
                                  className="mt-0.5 h-3.5 w-3.5 accent-gold"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12px] font-semibold text-ink">
                                    {widget.label}
                                  </span>
                                  <span className="mt-1 flex flex-wrap gap-1.5">
                                    <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">
                                      {widget.source}
                                    </span>
                                    <span className="mono rounded-[5px] border border-hairline px-1.5 py-0.5 text-[9px] text-label">
                                      {widget.size}
                                    </span>
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {devMode && (
            <div
              className="hidden items-center rounded-card border border-hairline bg-canvas p-0.5 md:flex"
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
