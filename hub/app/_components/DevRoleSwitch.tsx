"use client";

import { usePathname } from "next/navigation";
import { devRoleSwitchUsers } from "@/lib/auth/dev-role-switcher";
import type { Role } from "@/lib/phase2";

// Reusable dev role switcher used on the per-user Profile page and the Help →
// "Roles & access" page. It mints a REAL signed session via the server-side login
// route (/api/auth/login?role=…) — never a spoofable client query param — so RBAC
// is unchanged. This replaces the old header pills; PRD A5 requires the three roles
// stay easy to reach for reviewers in dev mode, just not in the top header.
const ROLE_BLURB: Record<Role, string> = {
  admin: "Marketing Lead — full access to every module and internal/dev surfaces.",
  leader: "Growth leader — Decision Queue view + act, plus broad read access.",
  operator: "Module owner — read/write owned modules, read-only elsewhere, submit-only decisions.",
};

export function DevRoleSwitch({ currentRole }: { currentRole?: Role | null }) {
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || "/profile");
  const options = devRoleSwitchUsers();

  return (
    <div className="grid gap-2.5 sm:grid-cols-3" data-testid="dev-role-switch">
      {options.map((user) => {
        const active = currentRole === user.role;
        return (
          <a
            key={user.id}
            // Sign in as the EXACT user shown (by id), not by role — role-resolution
            // re-picks the alphabetically-first profile of that role (DB order_by
            // display_name), which would land a different person than the card names.
            href={`/api/auth/login?userId=${user.id}&next=${next}`}
            aria-current={active ? "true" : undefined}
            className={`flex flex-col rounded-card border p-3 text-left shadow-sm transition-colors ${
              active
                ? "border-gold bg-fill"
                : "border-hairline bg-surface hover:border-border hover:bg-hover"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold capitalize text-ink">{user.role}</span>
              <span
                className={`mono rounded-card px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? "bg-ink-cta text-on-cta" : "bg-fill text-slate"
                }`}
              >
                {active ? "Current" : "Switch"}
              </span>
            </div>
            <span className="mt-1 text-[11px] leading-snug text-muted">{ROLE_BLURB[user.role]}</span>
            <span className="mono mt-2 text-[10px] text-label">
              Starts a real session as {user.name}
            </span>
          </a>
        );
      })}
    </div>
  );
}
