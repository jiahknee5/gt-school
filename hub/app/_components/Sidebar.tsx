"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MODULES, moduleHref } from "@/lib/modules";
import type { Role } from "@/lib/phase2";

export type SidebarViewer = {
  id: string;
  name: string;
  title: string;
  role: Role;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// Compact line icons keyed by module slug. Stroke = currentColor so active
// states recolor them for free.
const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  grassroots: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  content: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>
  ),
  "summer-camp": (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </>
  ),
  nurture: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  dashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  "crm-ops": (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  events: (
    <>
      <path d="M8 2v4M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  admissions: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  budget: (
    <>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  decisions: (
    <>
      <path d="M21.8 10A10 10 0 1 1 17 3.34" />
      <path d="m9 11 3 3L22 4" />
    </>
  ),
  library: (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
  analytics: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  "gt-challenge": (
    <>
      <path d="M12 3 4 7l8 4 8-4-8-4Z" />
      <path d="M4 11l8 4 8-4" />
      <path d="M8 15v4l4 2 4-2v-4" />
    </>
  ),
};

// Developer and data tooling.
const DEV_LINKS: { href: string; label: string; icon: ReactNode; exact?: boolean }[] = [
  {
    href: "/dev",
    label: "Data overview",
    exact: true,
    icon: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    ),
  },
  {
    href: "/dev/data-model",
    label: "Data model",
    icon: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </>
    ),
  },
  {
    href: "/dev/dictionary",
    label: "Data dictionary",
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  {
    href: "/opendata",
    label: "Open Data",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  },
];

const CAMPAIGN_LINKS: { href: string; label: string; slug: string }[] = [
  { href: "/m/gt-challenge", label: "GT Challenge", slug: "gt-challenge" },
];

function ModuleIcon({ slug }: { slug: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[slug] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

function LinkIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function Sidebar({
  viewer,
  devMode,
}: {
  viewer: SidebarViewer | null;
  devMode: boolean;
}) {
  const pathname = usePathname();
  // Internal/dev surfaces are Admin-only (middleware enforces; hide them otherwise).
  const showDevLinks = viewer?.role === "admin";
  const visibleModules = MODULES.filter((m) => !m.leaderOnly || viewer?.role === "leader");

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[228px] shrink-0 flex-col border-r border-hairline bg-side lg:flex">
      {/* brand */}
      <Link
        href="/"
        className="flex h-[57px] shrink-0 items-center gap-2.5 border-b border-hairline px-[18px] text-[15px] font-semibold text-ink"
      >
        <span className="grid h-6 w-6 place-items-center rounded-card bg-gold text-[13px] font-bold text-ink shadow-sm">
          GT
        </span>
        Marketing Hub
      </Link>

      {/* module nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="mono px-2.5 pb-1.5 text-[11px] font-semibold text-label">
          Modules
        </p>
        <ul className="flex flex-col gap-0.5">
          {visibleModules.map((m) => {
            const active =
              m.slug === "home" ? pathname === "/" : pathname === `/m/${m.slug}`;
            return (
              <li key={m.slug}>
                <Link
                  href={moduleHref(m.slug)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-2.5 rounded-card px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-ink-cta text-on-cta shadow-sm"
                      : "text-slate hover:bg-hover hover:text-ink"
                  }`}
                >
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center ${
                      active ? "text-gold" : "text-label group-hover:text-muted"
                    }`}
                  >
                    <ModuleIcon slug={m.slug} />
                  </span>
                  <span className="truncate">{m.short}</span>
                  {m.leaderOnly && (
                    <span className="mono ml-auto rounded-card bg-violet-soft px-1.5 py-px text-[9px] font-semibold text-violet">
                      Lead
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {viewer && (
          <ul className="mt-0.5 flex flex-col gap-0.5">
            <li>
              <Link
                href="/m/submissions"
                aria-current={pathname === "/m/submissions" ? "page" : undefined}
                className={`group flex items-center gap-2.5 rounded-card px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                  pathname === "/m/submissions"
                    ? "bg-ink-cta text-on-cta shadow-sm"
                    : "text-slate hover:bg-hover hover:text-ink"
                }`}
              >
                <span
                  className={`grid h-[18px] w-[18px] shrink-0 place-items-center ${
                    pathname === "/m/submissions" ? "text-gold" : "text-label group-hover:text-muted"
                  }`}
                >
                  <LinkIcon>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="m9 15 2 2 4-4" />
                  </LinkIcon>
                </span>
                <span className="truncate">My submissions</span>
              </Link>
            </li>
          </ul>
        )}

        <p className="mono px-2.5 pb-1.5 pt-4 text-[11px] font-semibold text-label">
          Campaigns
        </p>
        <ul className="flex flex-col gap-0.5">
          {CAMPAIGN_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-2.5 rounded-card px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                    active ? "bg-ink-cta text-on-cta shadow-sm" : "text-slate hover:bg-hover hover:text-ink"
                  }`}
                >
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center ${
                      active ? "text-gold" : "text-label group-hover:text-muted"
                    }`}
                  >
                    <ModuleIcon slug={l.slug} />
                  </span>
                  <span className="truncate">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {showDevLinks && (
          <>
            <p className="mono px-2.5 pb-1.5 pt-4 text-[11px] font-semibold text-label">
              Developer
            </p>
            <ul className="flex flex-col gap-0.5">
              {DEV_LINKS.map((l) => {
                const active = l.exact
                  ? pathname === l.href
                  : pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-card px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                        active ? "bg-ink-cta text-on-cta shadow-sm" : "text-slate hover:bg-hover hover:text-ink"
                      }`}
                    >
                      <span
                        className={`grid h-[18px] w-[18px] shrink-0 place-items-center ${
                          active ? "text-gold" : "text-label group-hover:text-muted"
                        }`}
                      >
                        <LinkIcon>{l.icon}</LinkIcon>
                      </span>
                      <span className="truncate">{l.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <p className="mono px-2.5 pb-1.5 pt-4 text-[11px] font-semibold text-label">
          Help
        </p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link
              href="/help"
              aria-current={
                pathname === "/help" || pathname.startsWith("/help/") ? "page" : undefined
              }
              className={`group flex items-center gap-2.5 rounded-card px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                pathname === "/help" || pathname.startsWith("/help/")
                  ? "bg-ink-cta text-on-cta shadow-sm"
                  : "text-slate hover:bg-hover hover:text-ink"
              }`}
            >
              <span
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center ${
                  pathname === "/help" || pathname.startsWith("/help/")
                    ? "text-gold"
                    : "text-label group-hover:text-muted"
                }`}
              >
                <LinkIcon>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </LinkIcon>
              </span>
              <span className="truncate">User guides</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* user and role */}
      <div className="shrink-0 border-t border-hairline px-3 py-3">
        {viewer ? (
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-cta text-[11px] font-semibold text-on-cta">
              {initials(viewer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-ink">{viewer.name}</p>
              <p className="mono truncate text-[10px] text-label">
                {viewer.role} | GT Anywhere
              </p>
            </div>
            <a
              href="/api/auth/logout"
              title={devMode ? "Sign out (dev session)" : "Sign out"}
              className="mono shrink-0 rounded-card border border-hairline px-2 py-1 text-[10px] font-semibold text-slate hover:bg-hover hover:text-ink"
            >
              Sign out
            </a>
          </div>
        ) : (
          <Link
            href="/login"
            prefetch={false}
            className="flex items-center justify-center rounded-card border border-border bg-canvas px-2.5 py-2 text-[12px] font-semibold text-ink hover:bg-hover"
          >
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
