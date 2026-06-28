"use client";

import { useState } from "react";
import { DataConfidenceBanner, type BannerStateLike } from "@/app/_components/DataConfidenceBanner";

// The two interactive proofs. Polish matters less than honesty: every value shown here is
// the real output of the production function (computed server-side, passed in) — the only
// thing the client does is reveal it step-by-step / toggle between two real states.

export type PaymentStep = { label: string; detail: string; value: string; tone: "neutral" | "good" | "watch" };

export function PaymentPropagationPlayer({ steps }: { steps: PaymentStep[] }) {
  const [shown, setShown] = useState(1);
  const atEnd = shown >= steps.length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShown((s) => Math.min(s + 1, steps.length))}
          disabled={atEnd}
          className="rounded-card bg-ink-cta px-2.5 py-1 text-[11px] font-semibold text-on-cta disabled:opacity-50"
        >
          {atEnd ? "Propagated ✓" : "▶ Step"}
        </button>
        <button
          type="button"
          onClick={() => setShown(steps.length)}
          disabled={atEnd}
          className="rounded-card border border-border bg-canvas px-2.5 py-1 text-[11px] font-semibold text-slate disabled:opacity-50"
        >
          Play all
        </button>
        <button
          type="button"
          onClick={() => setShown(1)}
          className="rounded-card border border-border bg-canvas px-2.5 py-1 text-[11px] font-semibold text-slate"
        >
          ↺ Reset
        </button>
        <span className="mono ml-auto text-[10px] text-label">{shown}/{steps.length}</span>
      </div>
      <ol className="flex flex-col">
        {steps.slice(0, shown).map((s, i) => {
          const tone = s.tone === "good" ? "border-green/40" : s.tone === "watch" ? "border-gold/40" : "border-hairline";
          return (
            <li key={i} className="flex flex-col">
              {i > 0 && <span className="ml-3 h-3 w-px bg-border" aria-hidden />}
              <div className={`rounded-card border bg-surface px-3 py-2 shadow-sm ${tone}`}>
                <div className="flex items-center gap-2">
                  <span className="mono grid h-4 w-4 place-items-center rounded-full bg-fill text-[9px] font-bold text-slate">{i + 1}</span>
                  <span className="text-[12px] font-semibold text-ink">{s.label}</span>
                  <span className="mono ml-auto text-[11px] font-semibold text-ink">{s.value}</span>
                </div>
                <p className="mono mt-0.5 text-[10px] leading-snug text-muted">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ParityDropToggle({ healthy, dropped }: { healthy: BannerStateLike; dropped: BannerStateLike }) {
  const [low, setLow] = useState(false);
  const state = low ? dropped : healthy;
  // The governed fields that sit in-parity at the lenient bar but cross BELOW once the policy
  // bar applies — the explicit threshold-cross this proof is about (real DB parity numbers).
  const crossing = dropped.below.filter((d) => !healthy.below.some((h) => h.field === d.field));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLow((v) => !v)}
          className={`rounded-card px-2.5 py-1 text-[11px] font-semibold ${low ? "bg-ink-cta text-on-cta" : "border border-border bg-canvas text-slate"}`}
        >
          {low ? `↩ Lower to the lenient ${healthy.thresholdPct}% bar` : `▲ Raise to the ${dropped.thresholdPct}% policy bar`}
        </button>
        <span className="mono text-[10px] text-label">
          overall {state.overallPct}% · bar {state.thresholdPct}% · {state.below.length} below
        </span>
      </div>
      {/* The REAL shared banner component the modules mount. Renders only when a field is below. */}
      {state.below.length > 0 ? (
        <DataConfidenceBanner state={state} />
      ) : (
        <p className="rounded-card border border-green/40 bg-green-soft/40 px-2.5 py-1.5 text-[11px] text-green">
          All governed fields above the {state.thresholdPct}% bar — no banner (healthy). Raise the bar to policy to watch it appear.
        </p>
      )}
      {crossing.length > 0 ? (
        <p className="mono mt-1.5 text-[9px] leading-snug text-label">
          Crosses below as the bar rises {healthy.thresholdPct}% → {dropped.thresholdPct}%:{" "}
          {crossing
            .map((f) => `${f.field} ${f.pct}%${f.expectedUnreliable ? " (known-unreliable)" : " (surprise)"}`)
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}
