"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dev", label: "Overview" },
  { href: "/dev/data-model", label: "Data model" },
  { href: "/dev/dictionary", label: "Data dictionary" },
  { href: "/dev/integrations", label: "Integrations" },
  { href: "/dev/payments", label: "Payments" },
  { href: "/dev/profiles", label: "Profiles" },
  { href: "/dev/agents", label: "Agent graph" },
  { href: "/dev/tests", label: "Test theater" },
];

export function DevTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-3 flex gap-0.5 border-b border-hairline">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-2 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "border-gold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
