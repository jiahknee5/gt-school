"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { DrawerSection } from "@/lib/status/board";
import { MetricCite } from "@/app/_components/MetricCite";
import { RankedMiniBar } from "./dataviz/RankedMiniBar";
import { FunnelMini } from "./dataviz/FunnelMini";
import { Sparkline } from "./dataviz/Sparkline";

export function StatusDrawer({
  open,
  title,
  sections,
  onClose,
}: {
  open: boolean;
  title: string;
  sections: DrawerSection[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-[min(444px,93vw)] flex-col border-l border-border bg-surface shadow-lg transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="status-drawer-title"
      >
        <div className="flex items-center justify-between gap-2 bg-ink-cta px-4 py-3 text-on-cta">
          <h2 id="status-drawer-title" className="font-serif text-[15px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-sm"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[11px] leading-relaxed">
          {sections.map((sec) => (
            <div key={sec.heading} className="mb-4">
              <h3 className="mono mb-1.5 border-b border-hairline pb-1 text-[9px] font-bold uppercase tracking-wide text-slate">
                {sec.heading}
              </h3>
              {sec.lines?.map((line) => (
                <p key={line} className="mb-1 text-ink">
                  {line}
                </p>
              ))}
              {sec.kv && (
                <dl className="grid grid-cols-2 gap-x-3">
                  {sec.kv.map((row) => (
                    <div key={row.label} className="flex justify-between border-t border-hairline py-1">
                      <dt className="text-muted">{row.label}</dt>
                      <dd
                        className={`mono font-bold ${
                          row.tone === "bad" ? "text-red" : row.tone === "good" ? "text-green" : "text-ink"
                        }`}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {sec.cites && (
                <dl className="mt-1.5 space-y-1">
                  {sec.cites.map((cite) => (
                    <div key={cite.label} className="flex items-center justify-between gap-2 border-t border-hairline pt-1">
                      <dt className="truncate text-[10px] text-muted">{cite.label}</dt>
                      <dd>
                        <MetricCite source={cite.source} homeModule={cite.homeModule} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {sec.rankedBars && <RankedMiniBar rows={sec.rankedBars} />}
              {sec.funnelSteps && <FunnelMini steps={sec.funnelSteps} />}
              {sec.sparkline && <Sparkline data={sec.sparkline} />}
              {sec.bullets && (
                <ul className="mt-1 space-y-1">
                  {sec.bullets.map((b, i) => (
                    <li key={i} className="font-serif text-[12px] text-ink">
                      {b.text}
                    </li>
                  ))}
                </ul>
              )}
              {sec.decision && (
                <div className="mt-2 rounded-card border border-border bg-canvas p-2.5">
                  <p className="text-[12px] font-bold text-ink">{sec.decision.question}</p>
                  <Link href={sec.decision.href} className="mono mt-2 inline-block text-[10px] font-semibold text-gold hover:underline">
                    Open in Decision Queue →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
