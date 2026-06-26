"use client";

// Homegrown, zero-dependency product tour (a.k.a. guided walkthrough / coach marks).
// A <TourProvider> lives in the root layout so its state survives client navigation
// between modules. useTour().start(spec) launches a step-by-step overlay that, per
// step, navigates to the right route, spotlights a real element tagged with
// data-tour="<target>", and explains WHAT to do, WHY, and WHAT HAPPENS. Steps with no
// target render as a centered "what's happening" card (e.g. background work).
//
// Data comes from lib/help/guides.ts (Guide.steps); see TourButton.tsx for the launcher.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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

type Rect = { top: number; left: number; width: number; height: number };

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [spec, setSpec] = useState<TourSpec | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const start = useCallback(
    (next: TourSpec) => {
      setSpec(next);
      setIndex(0);
      setRect(null);
      persist(next, 0);
    },
    [persist],
  );

  const close = useCallback(() => {
    setSpec(null);
    setRect(null);
    persist(null, 0);
  }, [persist]);

  const go = useCallback(
    (i: number) => {
      if (!spec) return;
      if (i < 0 || i >= spec.steps.length) {
        close();
        return;
      }
      setRect(null);
      setIndex(i);
      persist(spec, i);
    },
    [spec, close, persist],
  );

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
      queueMicrotask(() => setRect(null)); // centered "what's happening" card
      return;
    }

    let tries = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        return;
      }
      if (tries++ < 50) {
        pollRef.current = setTimeout(tick, 60);
      } else {
        setRect(null); // never appeared — fall back to a centered card
      }
    };
    tick();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [spec, index, pathname, router]);

  // Keep the spotlight glued to the element as the page scrolls / resizes.
  useEffect(() => {
    const step = spec?.steps[index];
    if (!step?.target) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [spec, index]);

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
          rect={rect}
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
  rect,
  onBack,
  onNext,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  title: string;
  rect: Rect | null;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const last = index === total - 1;
  const first = index === 0;

  // Popover placement: anchored under (or over) the spotlight, else centered.
  let popoverStyle: React.CSSProperties;
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.top + rect.height + 16 + 220 < vh;
    const left = Math.min(Math.max(rect.left, 12), vw - POPOVER_W - 12);
    popoverStyle = below
      ? { position: "fixed", top: rect.top + rect.height + 14, left, width: POPOVER_W }
      : {
          position: "fixed",
          top: rect.top - 14,
          left,
          width: POPOVER_W,
          transform: "translateY(-100%)",
        };
  } else {
    popoverStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: POPOVER_W,
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <>
      {/* Dimmer. With a target, a box-shadow ring cuts the spotlight hole and lets
          clicks pass through (pointer-events-none). Without one, a plain blocking scrim. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] rounded-[10px]"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0, 17, 23, 0.55)",
            outline: "2px solid var(--gold)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 z-[90] bg-[rgba(0,17,23,0.55)]" onClick={onClose} />
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
            onClick={onClose}
            aria-label="End tour"
            className="mono text-[11px] text-label hover:text-ink"
          >
            Esc ✕
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

        {step.target && (
          <p className="mono mt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-gold">
            Highlighted on the page
          </p>
        )}

        {/* progress dots */}
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= index ? "bg-gold" : "bg-hairline"}`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            disabled={first}
            className="rounded-card px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            className="rounded-card bg-ink-cta px-3 py-1.5 text-[12px] font-semibold text-on-cta shadow-sm transition-transform active:translate-y-px"
          >
            {last ? "Finish ✓" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );
}
