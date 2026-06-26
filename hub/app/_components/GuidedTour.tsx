"use client";

// Homegrown, zero-dependency product tour (a.k.a. guided walkthrough / coach marks).
// A <TourProvider> lives in the root layout so its state survives client navigation
// between modules. useTour().start(spec) launches a step-by-step overlay that, per step:
//   - navigates to the right route,
//   - BLURS + dims the whole page except a sharp cut-out around the target element
//     (tagged with data-tour="<target>") so the user's focus is forced there,
//   - explains WHAT to do, WHY, and WHAT HAPPENS,
//   - and, when the highlighted element is something you CLICK (a button/link), GATES
//     advancement on the user actually clicking it — you can't move on until you do.
// Steps with no target render as a centered "what's happening" card (e.g. background work).
//
// Data comes from lib/help/guides.ts (Guide.steps); see TourButton.tsx for the launcher.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

export interface TourStep {
  /** What the user does. */
  do: string;
  /** Where it happens (module / sub-view) — shown as a chip. */
  where: string;
  /** What the system does in response. */
  result: string;
  /** Why this step matters (the rationale). */
  why?: string;
  /** Route to navigate to before showing this step. */
  href?: string;
  /** data-tour anchor to spotlight on the page. */
  target?: string;
}

export interface TourSpec {
  slug: string;
  title: string;
  steps: TourStep[];
}

interface TourContextValue {
  start: (spec: TourSpec) => void;
  active: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within <TourProvider>");
  return ctx;
}

const STORAGE_KEY = "gt-hub-tour";
const POPOVER_W = 344;

// clip-path: path() is what lets one blurred overlay keep a SHARP hole over the target.
// Modern Chrome/Safari/Firefox support it; degrade to a non-blur dim ring otherwise.
const SUPPORTS_CLIP =
  typeof CSS !== "undefined" && typeof CSS.supports === "function"
    ? CSS.supports("clip-path", 'path("M0 0Z")')
    : false;

type Rect = { top: number; left: number; width: number; height: number };

/** The element a click on advances the tour, if the target is a click control. */
function clickGate(el: HTMLElement): HTMLElement | null {
  return el.matches('button, a[href], [role="button"]') ? el : null;
}

/** Sharp cut-out region: a submit button widens to its whole form so the user can fill it. */
function holeElement(el: HTMLElement, control: HTMLElement | null): HTMLElement {
  if (control && control.getAttribute("type") === "submit") {
    const form = control.closest("form");
    if (form instanceof HTMLElement) return form;
  }
  return el;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [spec, setSpec] = useState<TourSpec | null>(null);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  // When the target is a click control, gateTarget holds its data-tour value and the
  // tour will not advance until the user clicks it (delegated, so it survives remounts).
  const [gateTarget, setGateTarget] = useState<string | null>(null);
  const [gateLabel, setGateLabel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Resume across a hard reload (client nav already preserves provider state).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMounted(true);
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { spec: TourSpec; index: number };
          if (saved?.spec?.steps?.length) {
            setSpec(saved.spec);
            setIndex(Math.min(saved.index ?? 0, saved.spec.steps.length - 1));
          }
        }
      } catch {
        /* ignore malformed storage */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((s: TourSpec | null, i: number) => {
    try {
      if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ spec: s, index: i }));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const clearTarget = useCallback(() => {
    setHole(null);
    setGateTarget(null);
    setGateLabel(null);
  }, []);

  const start = useCallback(
    (next: TourSpec) => {
      clearTarget();
      setSpec(next);
      setIndex(0);
      persist(next, 0);
    },
    [persist, clearTarget],
  );

  const close = useCallback(() => {
    clearTarget();
    setSpec(null);
    persist(null, 0);
  }, [persist, clearTarget]);

  const go = useCallback(
    (i: number) => {
      if (!spec) return;
      if (i < 0 || i >= spec.steps.length) {
        close();
        return;
      }
      clearTarget();
      setIndex(i);
      persist(spec, i);
    },
    [spec, close, persist, clearTarget],
  );

  // Measure the current step's target into state (hole + click-gate). Returns false
  // if the element isn't in the DOM yet (caller keeps polling).
  const measure = useCallback((target: string): boolean => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) return false;
    const control = clickGate(el);
    setHole(rectOf(holeElement(el, control)));
    setGateTarget(control ? target : null);
    setGateLabel(
      control ? control.textContent?.replace(/\s+/g, " ").trim().slice(0, 36) || null : null,
    );
    return true;
  }, []);

  // Navigate to the step's route, then poll for its spotlight target.
  useEffect(() => {
    if (!spec) return;
    const step = spec.steps[index];
    if (!step) return;

    if (step.href && pathname !== step.href) {
      router.push(step.href);
      return; // effect re-runs once pathname updates
    }
    if (!step.target) {
      queueMicrotask(clearTarget); // centered "what's happening" card
      return;
    }

    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        measure(step.target!);
        return;
      }
      if (tries++ < 50) timer = setTimeout(tick, 60);
      else clearTarget(); // never appeared — fall back to a centered card
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [spec, index, pathname, router, measure, clearTarget]);

  // Keep the cut-out glued to the element as the page scrolls / resizes.
  useEffect(() => {
    const step = spec?.steps[index];
    if (!step?.target) return;
    const update = () => measure(step.target!);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [spec, index, measure]);

  // ACTION GATE: when the target is a click control, advance only after the user clicks
  // it. Delegated at the document (capture) so it keeps working if the element remounts;
  // a disabled control (e.g. a submit button before the form is filled) emits no click,
  // so the tour stays put until the user completes the action and clicks.
  useEffect(() => {
    if (!gateTarget) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(`[data-tour="${gateTarget}"]`)) {
        // let the element's own handler (form submit, navigation) run first
        setTimeout(() => go(index + 1), 80);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [gateTarget, index, go]);

  // Esc to exit.
  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec, close]);

  const step = spec?.steps[index];

  return (
    <TourContext.Provider value={{ start, active: Boolean(spec) }}>
      {children}
      {mounted && spec && step && (
        <TourOverlay
          step={step}
          index={index}
          total={spec.steps.length}
          title={spec.title}
          hole={hole}
          gated={Boolean(gateTarget)}
          gateLabel={gateLabel}
          onBack={() => go(index - 1)}
          onNext={() => go(index + 1)}
          onClose={close}
        />
      )}
    </TourContext.Provider>
  );
}

function TourOverlay({
  step,
  index,
  total,
  title,
  hole,
  gated,
  gateLabel,
  onBack,
  onNext,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  title: string;
  hole: Rect | null;
  gated: boolean;
  gateLabel: string | null;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const last = index === total - 1;
  const first = index === 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Popover placement: beside the cut-out when there's a gutter (so it never covers the
  // thing you must interact with), else above/below, always clamped fully on-screen.
  const EST_H = 300;
  let popoverStyle: React.CSSProperties;
  if (hole) {
    const clampTop = (t: number) => Math.min(Math.max(t, 12), vh - EST_H - 12);
    const rightGutter = vw - (hole.left + hole.width);
    if (rightGutter >= POPOVER_W + 28) {
      popoverStyle = { position: "fixed", top: clampTop(hole.top), left: hole.left + hole.width + 16, width: POPOVER_W };
    } else if (hole.left >= POPOVER_W + 28) {
      popoverStyle = { position: "fixed", top: clampTop(hole.top), left: hole.left - POPOVER_W - 16, width: POPOVER_W };
    } else {
      const left = Math.min(Math.max(hole.left, 12), vw - POPOVER_W - 12);
      let top = hole.top + hole.height + 14;
      if (top + EST_H > vh - 12) top = hole.top - 14 - EST_H;
      popoverStyle = { position: "fixed", top: clampTop(top), left, width: POPOVER_W };
    }
  } else {
    popoverStyle = { position: "fixed", top: "50%", left: "50%", width: POPOVER_W, transform: "translate(-50%, -50%)" };
  }

  // Blurred dimmer with a sharp rectangular hole over the target (evenodd clip-path).
  const PAD = 8;
  let clip: string | undefined;
  if (hole && SUPPORTS_CLIP) {
    const x = Math.round(Math.max(hole.left - PAD, 0));
    const y = Math.round(Math.max(hole.top - PAD, 0));
    const r = Math.round(Math.min(hole.left + hole.width + PAD, vw));
    const b = Math.round(Math.min(hole.top + hole.height + PAD, vh));
    clip = `path(evenodd, "M0 0H${vw}V${vh}H0Z M${x} ${y}H${r}V${b}H${x}Z")`;
  }

  return (
    <>
      {hole && SUPPORTS_CLIP ? (
        <>
          {/* Blur + dim everything; the clip-path hole stays sharp AND lets clicks through
              to the target, while clicks elsewhere are absorbed (forced focus). */}
          <div
            aria-hidden
            className="fixed inset-0 z-[90]"
            style={{
              backgroundColor: "rgba(0, 17, 23, 0.34)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              clipPath: clip,
              WebkitClipPath: clip,
            }}
          />
          {/* Gold ring around the cut-out */}
          <div
            aria-hidden
            className="pointer-events-none fixed z-[95] rounded-[10px]"
            style={{
              top: hole.top - PAD,
              left: hole.left - PAD,
              width: hole.width + PAD * 2,
              height: hole.height + PAD * 2,
              border: "2px solid var(--gold)",
              boxShadow: "0 0 0 2px rgba(228,139,83,0.25), 0 8px 30px rgba(0,17,23,0.25)",
            }}
          />
        </>
      ) : hole ? (
        // Fallback (no clip-path path support): dim ring via box-shadow, target clickable.
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] rounded-[10px]"
          style={{
            top: hole.top - 6,
            left: hole.left - 6,
            width: hole.width + 12,
            height: hole.height + 12,
            boxShadow: "0 0 0 9999px rgba(0, 17, 23, 0.55)",
            outline: "2px solid var(--gold)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        // No target: full blurred scrim; click it to dismiss.
        <div
          aria-hidden
          className="fixed inset-0 z-[90] bg-[rgba(0,17,23,0.45)]"
          style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
      )}

      {/* Popover */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Product tour: ${title}`}
        style={popoverStyle}
        className="z-[100] rounded-card border border-hairline bg-surface p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            Product tour
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="End tour"
            className="rounded-card border border-hairline px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            Close
          </button>
        </div>

        <p className="mono mt-1 text-[10px] uppercase tracking-[0.08em] text-label">{title}</p>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-cta text-[10px] font-bold text-on-cta">
            {index + 1}
          </span>
          <span className="mono text-[10px] text-slate">
            Step {index + 1} of {total}
          </span>
          <span className="mono ml-auto truncate rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">
            {step.where}
          </span>
        </div>

        <p className="mt-2 text-[13px] font-semibold leading-snug text-ink">{step.do}</p>

        {step.why && (
          <p className="mt-1.5 text-[11px] leading-snug text-muted">
            <span className="font-semibold text-slate">Why: </span>
            {step.why}
          </p>
        )}

        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          <span className="font-semibold text-slate">What happens: </span>
          {step.result}
        </p>

        {/* Action prompt: a gated step tells the user exactly what to do to proceed. */}
        {gated ? (
          <div className="mt-2.5 rounded-card border border-gold bg-fill px-2.5 py-2">
            <p className="text-[11px] font-semibold leading-snug text-ink">
              Do it to continue{gateLabel ? <> — click <span className="text-gold">“{gateLabel}”</span> in the highlighted area.</> : " — use the highlighted control."}
            </p>
          </div>
        ) : (
          step.target && (
            <p className="mono mt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-gold">
              Highlighted on the page
            </p>
          )
        )}

        <div aria-hidden className="mt-3 flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= index ? "bg-gold" : "bg-hairline"}`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={first}
            className="rounded-card px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {gated ? (
            <span className="mono text-[10px] text-label">Waiting for your action…</span>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="rounded-card bg-ink-cta px-3 py-1.5 text-[12px] font-semibold text-on-cta shadow-sm transition-transform active:translate-y-px"
            >
              {last ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
