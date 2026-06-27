"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NAV_SCOPE_LABELS, NAV_SCOPES, type NavScope } from "@/lib/nav";

export function NavScopeControl({
  initialScope,
}: {
  initialScope: NavScope;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<NavScope>(initialScope);
  const [pending, startTransition] = useTransition();

  function onChange(next: NavScope) {
    setScope(next);
    startTransition(async () => {
      await fetch("/api/nav/scope", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ navScope: next }),
      });
      router.refresh();
    });
  }

  return (
    <div className="px-2.5 pb-2">
      <p className="mono mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
        View
      </p>
      <div
        className="flex rounded-card border border-hairline bg-canvas p-0.5"
        role="group"
        aria-label="Sidebar module view"
      >
        {NAV_SCOPES.map((value) => {
          const active = scope === value;
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={active}
              title={NAV_SCOPE_LABELS[value]}
              onClick={() => onChange(value)}
              className={`min-w-0 flex-1 truncate rounded-[6px] px-1 py-1 text-[9px] font-semibold transition-colors ${
                active
                  ? "bg-ink-cta text-on-cta shadow-sm"
                  : "text-slate hover:bg-hover hover:text-ink"
              }`}
            >
              {value === "my" ? "My" : value === "all" ? "All" : "Agenda"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
