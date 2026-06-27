"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  PROGRAM_SCOPE_LABELS,
  PROGRAM_SCOPE_SHORT,
  type ProgramScope,
} from "@/lib/program-scope";

// Global active-program selector — the program view-lens sibling of NavScopeControl.
// Lives in the sidebar header so both global lenses (program + My/All modules) sit
// together. Single-program roles (operators, locked to Fall) get a static, disabled
// label instead of a toggle — they can never pick another program (RBAC enforced
// server-side in api/program/scope too).
export function ProgramScopeControl({
  initialScope,
  scopes,
}: {
  initialScope: ProgramScope;
  scopes: ProgramScope[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<ProgramScope>(initialScope);
  const [pending, startTransition] = useTransition();

  function onChange(next: ProgramScope) {
    if (next === scope) return;
    setScope(next);
    startTransition(async () => {
      await fetch("/api/program/scope", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programScope: next }),
      });
      router.refresh();
    });
  }

  return (
    <div className="px-2.5 pb-2">
      <p className="mono mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
        Program
      </p>
      {scopes.length <= 1 ? (
        <div
          className="flex items-center rounded-card border border-hairline bg-canvas px-2 py-1"
          title={`${PROGRAM_SCOPE_LABELS[scope]} (your role is scoped to this program)`}
        >
          <span className="mono truncate text-[10px] font-semibold text-slate">
            {PROGRAM_SCOPE_LABELS[scope]}
          </span>
          <span className="mono ml-auto shrink-0 text-[8px] uppercase tracking-[0.08em] text-label">
            Locked
          </span>
        </div>
      ) : (
        <div
          className="flex rounded-card border border-hairline bg-canvas p-0.5"
          role="group"
          aria-label="Active program"
        >
          {scopes.map((value) => {
            const active = scope === value;
            return (
              <button
                key={value}
                type="button"
                disabled={pending}
                aria-pressed={active}
                title={PROGRAM_SCOPE_LABELS[value]}
                onClick={() => onChange(value)}
                className={`min-w-0 flex-1 truncate rounded-[6px] px-1 py-1 text-[9px] font-semibold transition-colors ${
                  active
                    ? "bg-ink-cta text-on-cta shadow-sm"
                    : "text-slate hover:bg-hover hover:text-ink"
                }`}
              >
                {PROGRAM_SCOPE_SHORT[value]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
