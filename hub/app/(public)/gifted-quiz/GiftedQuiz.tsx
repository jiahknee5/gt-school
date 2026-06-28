"use client";

// Public GT Challenge quiz — the marketing funnel surface a parent lands on from a
// social ad (no Hub account, no session). It is rendered as a full-bleed overlay so it
// does NOT pull the authed Hub chrome (sidebar/top bar) even though it lives under the
// root layout — this avoids restructuring the shared root layout/route groups while
// still satisfying Lindqvist's "no Hub sidebar" legibility gate (docs/06-gt-challenge).
//
// It POSTs to the already-built /api/gifted-quiz route (consent-gated, deduped by
// idempotency key, rate-limited). The quiz is framed as a FIT SCREEN, not a gifted
// verdict (Ortiz): the lowest bucket is "Keep exploring", never "not gifted".

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Scale = 1 | 2 | 3 | 4 | 5;

type ScaleQuestion = {
  key: string;
  prompt: string;
  help: string;
  low: string;
  high: string;
};

const SCALE_QUESTIONS: ScaleQuestion[] = [
  {
    key: "patternReasoning",
    prompt: "Spots patterns and connections others miss",
    help: "Notices rules, sequences, or relationships without being told.",
    low: "Rarely",
    high: "Almost always",
  },
  {
    key: "curiosity",
    prompt: "Asks deep, persistent questions",
    help: "Keeps asking why and what-if well past the easy answer.",
    low: "Rarely",
    high: "Constantly",
  },
  {
    key: "selfDirectedProjects",
    prompt: "Starts and sticks with their own projects",
    help: "Builds, writes, codes, or invents things no one assigned.",
    low: "Rarely",
    high: "Very often",
  },
  {
    key: "focusPersistence",
    prompt: "Stays with a hard problem until it clicks",
    help: "Returns to a challenge instead of giving up when it gets difficult.",
    low: "Rarely",
    high: "Almost always",
  },
];

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];

// The static demo email prefilled by ?demo=1. At submit it's rewritten to a unique
// variant so each demo run creates a fresh, distinct real lead (a new match_key) rather
// than de-duping onto one family. Uses example.com — HubSpot rejects .test emails, and the
// HubSpot-first deposit needs a valid address to create the contact.
export const DEMO_EMAIL = "harper.demo@example.com";

type Result = {
  duplicate: boolean;
  bucket: "strong_fit" | "promising" | "explore";
  rawScore: number;
  status: string;
  // Identity + verdict that drive the deposit step. leadId is the family_id the deposit
  // charges against; qualified gates whether the "secure your spot" CTA appears at all.
  leadId: string;
  qualified: boolean;
};

const BUCKET_COPY: Record<
  Result["bucket"],
  { title: string; tone: string; body: string }
> = {
  strong_fit: {
    title: "Strong fit",
    tone: "bg-green-soft text-green border-green-soft",
    body: "Your child's responses line up well with how GT students thrive. Our admissions team would love to talk about next steps.",
  },
  promising: {
    title: "Promising fit",
    tone: "bg-amber-soft text-amber border-amber-soft",
    body: "There are strong signals here worth exploring together. We'll reach out with ways to learn more about GT.",
  },
  explore: {
    title: "Keep exploring",
    tone: "bg-fill text-slate border-fill",
    body: "Every child grows on their own timeline. We'll keep you in the loop on GT events and resources. This is a fit indicator, never a verdict on your child.",
  },
};

function readUtm(): { source: string; medium: string; campaign: string } {
  if (typeof window === "undefined") {
    return { source: "", medium: "", campaign: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") ?? "",
    medium: params.get("utm_medium") ?? "",
    campaign: params.get("utm_campaign") ?? "",
  };
}

function ScaleField({
  question,
  value,
  onChange,
}: {
  question: ScaleQuestion;
  value: Scale | null;
  onChange: (v: Scale) => void;
}) {
  return (
    <fieldset className="rounded-card border border-hairline bg-surface p-3">
      <legend className="px-1 text-[13px] font-semibold text-ink">{question.prompt}</legend>
              <p className="mt-1 text-[11px] leading-snug text-muted">{question.help}</p>
      <div className="mt-3 flex items-center gap-1.5">
        {([1, 2, 3, 4, 5] as Scale[]).map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              aria-label={`${question.prompt}: ${n} of 5`}
              onClick={() => onChange(n)}
              className={`h-10 flex-1 rounded-card border text-[13px] font-semibold transition-colors ${
                active
                  ? "border-gold bg-ink-cta text-on-cta shadow-sm"
                  : "border-border bg-canvas text-slate hover:border-gold hover:text-ink"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mono mt-1.5 flex justify-between text-[10px] text-label">
        <span>{question.low}</span>
        <span>{question.high}</span>
      </div>
    </fieldset>
  );
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `gtc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface QuizPrefill {
  scales: Record<string, Scale | null>;
  readingAboveGrade: boolean | null;
  childFirstName: string;
  childGrade: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  zip: string;
  consent: boolean;
  parentObservation: string;
}

export function GiftedQuiz({ prefill }: { prefill?: QuizPrefill | null } = {}) {
  // One idempotency key per attempt — stable across accidental double-submits so the
  // backbone collapses them to a single submission + lead. Generated off the render path
  // (impure) and captured in a ref so resubmits reuse it.
  const idempotencyKey = useRef<string | null>(null);
  const utm = useRef<{ source: string; medium: string; campaign: string }>({
    source: "",
    medium: "",
    campaign: "",
  });

  useEffect(() => {
    if (idempotencyKey.current == null) {
      idempotencyKey.current = newIdempotencyKey();
    }
    utm.current = readUtm();
  }, []);

  // Initial state comes from the server-provided prefill (demo mode) or the empty
  // defaults — set as useState initializers so SSR and client hydrate identically.
  const [scales, setScales] = useState<Record<string, Scale | null>>(
    prefill?.scales ?? Object.fromEntries(SCALE_QUESTIONS.map((q) => [q.key, null])),
  );
  const [readingAboveGrade, setReadingAboveGrade] = useState<boolean | null>(prefill?.readingAboveGrade ?? null);
  const [parentObservation, setParentObservation] = useState(prefill?.parentObservation ?? "");
  const [childFirstName, setChildFirstName] = useState(prefill?.childFirstName ?? "");
  const [childGrade, setChildGrade] = useState(prefill?.childGrade ?? "");
  const [parentFirstName, setParentFirstName] = useState(prefill?.parentFirstName ?? "");
  const [parentLastName, setParentLastName] = useState(prefill?.parentLastName ?? "");
  const [parentEmail, setParentEmail] = useState(prefill?.parentEmail ?? "");
  const [parentPhone, setParentPhone] = useState(prefill?.parentPhone ?? "");
  const [zip, setZip] = useState(prefill?.zip ?? "");
  const [consent, setConsent] = useState(prefill?.consent ?? false);

  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const answeredScales = useMemo(
    () => SCALE_QUESTIONS.filter((q) => scales[q.key] != null).length,
    [scales],
  );
  const totalQuestions = SCALE_QUESTIONS.length + 1; // + reading-above-grade
  const answered = answeredScales + (readingAboveGrade != null ? 1 : 0);
  const progress = Math.round((answered / totalQuestions) * 100);

  const canSubmit =
    consent &&
    childGrade.trim() !== "" &&
    (parentEmail.trim() !== "" || parentPhone.trim() !== "") &&
    answeredScales === SCALE_QUESTIONS.length &&
    readingAboveGrade != null &&
    status !== "submitting";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!consent) {
      setError("Please confirm parent consent before submitting.");
      return;
    }
    setStatus("submitting");
    setError(null);

    // Generated in this event handler (not during render) and reused on resubmit.
    if (idempotencyKey.current == null) {
      idempotencyKey.current = newIdempotencyKey();
    }
    const submissionKey = idempotencyKey.current;

    // In demo mode the prefilled email is static; make it unique per submit (plus-addressing)
    // so each run is a fresh, distinct real lead. Date.now() is fine here — event handler,
    // not render. A real parent who edits the email submits exactly what they typed.
    const submitEmail =
      parentEmail.trim() === DEMO_EMAIL
        ? `harper.demo.${Date.now()}@example.com`
        : parentEmail.trim();

    const answers: Record<string, unknown> = {
      ...scales,
      readingAboveGrade,
      parentObservation: parentObservation.trim(),
    };

    try {
      const res = await fetch("/api/gifted-quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotency_key: submissionKey,
          parent_consent: consent,
          parent_email: submitEmail || null,
          parent_phone: parentPhone.trim() || null,
          parent_first_name: parentFirstName.trim() || null,
          parent_last_name: parentLastName.trim() || null,
          zip: zip.trim() || null,
          child_first_name: childFirstName.trim() || null,
          child_grade: childGrade.trim(),
          answers,
          utm_source: utm.current.source || null,
          utm_medium: utm.current.medium || null,
          utm_campaign: utm.current.campaign || null,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Something went wrong submitting the Challenge. Please try again.",
        );
        return;
      }

      const capture = body.capture ?? {};
      setResult({
        duplicate: Boolean(capture.duplicate),
        bucket: (capture.bucket as Result["bucket"]) ?? "explore",
        rawScore: Number(capture.rawScore ?? 0),
        status: String(capture.status ?? "scored"),
        leadId: String(capture.leadId ?? ""),
        qualified: Boolean(capture.qualified),
      });
      setStatus("done");
    } catch {
      setStatus("error");
      setError("We couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[linear-gradient(160deg,var(--paper)_0%,var(--paper)_55%,var(--fill)_100%)]">
      <div className="mx-auto w-full max-w-[560px] px-4 py-8 sm:py-10">
        <header className="flex items-center gap-2.5">
          <Image
            src="/gt-icon.svg"
            alt="GT School"
            width={32}
            height={32}
            priority
            unoptimized
            className="h-7 w-7"
          />
          <span className="text-[13px] font-semibold text-ink">GT Anywhere</span>
        </header>

        {status === "done" && result ? (
          <ResultScreen result={result} childFirstName={childFirstName} />
        ) : (
          <form onSubmit={handleSubmit} className="mt-5">
            <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
              The GT Challenge
            </p>
            <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[24px]">
              Is your child ready for more?
            </h1>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">
              Six quick questions about how your child learns. You get an instant fit
              indicator. This is a screen to start a conversation, not a gifted test or a
              verdict on your child.
            </p>

            {/* progress */}
            <div className="mt-4" aria-hidden="true">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mono mt-1.5 text-[10px] text-label">
                {answered} of {totalQuestions} answered
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              {SCALE_QUESTIONS.map((q) => (
                <ScaleField
                  key={q.key}
                  question={q}
                  value={scales[q.key] ?? null}
                  onChange={(v) => setScales((prev) => ({ ...prev, [q.key]: v }))}
                />
              ))}

              <fieldset className="rounded-card border border-hairline bg-surface p-3">
                <legend className="px-1 text-[13px] font-semibold text-ink">
                  Reads above their grade level
                </legend>
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  Chooses books or material meant for older kids.
                </p>
                <div className="mt-3 flex gap-2">
                  {[
                    { label: "Yes", value: true },
                    { label: "Not yet", value: false },
                  ].map((opt) => {
                    const active = readingAboveGrade === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setReadingAboveGrade(opt.value)}
                        className={`h-10 flex-1 rounded-card border text-[13px] font-semibold transition-colors ${
                          active
                            ? "border-gold bg-ink-cta text-on-cta shadow-sm"
                            : "border-border bg-canvas text-slate hover:border-gold hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block rounded-card border border-hairline bg-surface p-3">
                <span className="text-[13px] font-semibold text-ink">
                  Anything you&apos;d add? <span className="font-normal text-label">(optional)</span>
                </span>
                <textarea
                  value={parentObservation}
                  onChange={(e) => setParentObservation(e.target.value)}
                  rows={3}
                  placeholder="A moment that made you think: where did that come from?"
                  className="mt-2 w-full resize-y rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink placeholder:text-label focus:border-gold focus:outline-none"
                />
              </label>
            </div>

            {/* contact + child */}
            <div className="mt-4 space-y-2.5 rounded-card border border-hairline bg-surface p-3">
              <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
                Where do we send the result?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate">Child&apos;s first name</span>
                  <input
                    value={childFirstName}
                    onChange={(e) => setChildFirstName(e.target.value)}
                    className="mt-1 w-full rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate">
                    Grade <span className="text-red">*</span>
                  </span>
                  <select
                    value={childGrade}
                    onChange={(e) => setChildGrade(e.target.value)}
                    required
                    className="mt-1 h-[42px] w-full rounded-card border border-border bg-canvas px-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                  >
                    <option value="">Select</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g === "K" ? "Kindergarten" : `Grade ${g}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate">Your first name</span>
                  <input
                    value={parentFirstName}
                    onChange={(e) => setParentFirstName(e.target.value)}
                    autoComplete="given-name"
                    className="mt-1 w-full rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate">Your last name</span>
                  <input
                    value={parentLastName}
                    onChange={(e) => setParentLastName(e.target.value)}
                    autoComplete="family-name"
                    className="mt-1 w-full rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[12px] font-semibold text-slate">Parent email</span>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="mt-1 w-full rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                  placeholder="you@example.com"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate">Phone</span>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="mt-1 w-full rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                    placeholder="(512) 555-0100"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate">ZIP</span>
                  <input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="mt-1 w-full rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                    placeholder="78704"
                  />
                </label>
              </div>
              <p className="mono text-[10px] text-label">
                Provide an email or phone so we can share the result.
              </p>
            </div>

            {/* consent — directly above the submit (Schwartz / Lindqvist gate) */}
            <label className="mt-4 flex items-start gap-2.5 rounded-card border border-hairline bg-canvas p-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]"
              />
              <span className="text-[11px] leading-snug text-slate">
                I&apos;m this child&apos;s parent or guardian and I consent to GT Anywhere using
                these responses to follow up about programs. We collect the minimum needed and
                never label a child out. No submission is stored without this consent.
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-card border border-red-soft bg-red-soft px-3 py-2 text-[12px] font-medium text-red"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              data-tour="tour-gtc-quiz"
              disabled={!canSubmit}
              className="mt-4 h-11 w-full rounded-card bg-ink-cta text-[14px] font-semibold text-on-cta shadow-sm transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting..." : "See our fit"}
            </button>
            <p className="mono mt-3 text-center text-[10px] text-label">
              A fit screen, not a gifted diagnosis. Your data stays minimal and consent-gated.
            </p>
          </form>
        )}

        <footer className="mt-6 border-t border-hairline pt-4 text-center text-[11px] leading-snug text-label">
          GT Anywhere is the accredited K–8 virtual school from{" "}
          <a href="https://gt.school" className="font-semibold text-muted underline-offset-2 hover:underline">
            GT School
          </a>
          , part of the{" "}
          <a href="https://alpha.school" className="font-semibold text-muted underline-offset-2 hover:underline">
            Alpha School
          </a>{" "}
          family of microschools — powered by 2 Hour Learning.
        </footer>
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  childFirstName,
}: {
  result: Result;
  childFirstName: string;
}) {
  const copy = BUCKET_COPY[result.bucket];
  const name = childFirstName.trim() || "Your child";
  const router = useRouter();

  // Deposit step — only offered to a qualified lead with a real family_id. A real Stripe
  // TEST charge flows through /api/demo/checkout → records a payment, flips the enrollment
  // to paid, enqueues the HubSpot sync — then we send the parent to the live tracker that
  // reads THAT record back from the DB. This is the watchable end-to-end slice.
  const canDeposit = result.qualified && result.leadId !== "";
  const [checkout, setCheckout] = useState<"idle" | "charging" | "error">("idle");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleDeposit() {
    setCheckout("charging");
    setCheckoutError(null);
    try {
      const res = await fetch("/api/demo/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familyId: result.leadId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setCheckout("error");
        setCheckoutError(
          typeof body?.error === "string" ? body.error : "Deposit could not be processed.",
        );
        return;
      }
      router.push(`/track/${encodeURIComponent(String(body.trackKey ?? result.leadId))}`);
    } catch {
      setCheckout("error");
      setCheckoutError("We couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="mt-6">
      {result.duplicate && (
        <p className="mono mb-3 rounded-card border border-amber-soft bg-amber-soft px-3 py-2 text-[11px] font-semibold text-amber">
          We already have these responses. Here is your result again. We will not create a
          duplicate.
        </p>
      )}
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Your GT Challenge result
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[24px]">
        {name}: {copy.title}
      </h1>
      <span
        className={`mono mt-3 inline-block rounded-card border px-2 py-0.5 text-[11px] font-semibold ${copy.tone}`}
      >
        {copy.title} &middot; fit indicator
      </span>
      <p className="mt-2 text-[12px] leading-snug text-muted">{copy.body}</p>

      {canDeposit ? (
        <div className="mt-4 rounded-card border border-green-soft bg-green-soft p-3">
          <p className="text-[13px] font-semibold text-green">Secure {name}&apos;s Fall spot</p>
          <p className="mt-1 text-[11px] leading-snug text-slate">
            Qualified families can reserve a seat now with a refundable $100 deposit. Fall
            enrollment closes Aug 17 and spots are limited.
          </p>
          {checkoutError && (
            <p role="alert" className="mono mt-2 text-[11px] font-semibold text-red">
              {checkoutError}
            </p>
          )}
          <button
            type="button"
            onClick={handleDeposit}
            disabled={checkout === "charging"}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-card bg-ink-cta text-[14px] font-semibold text-on-cta shadow-sm transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkout === "charging" ? "Processing deposit..." : "Secure your spot — pay $100 deposit"}
          </button>
          <p className="mono mt-2 text-center text-[10px] text-label">
            Stripe test mode · then watch your spot move through our system live.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-card border border-hairline bg-surface p-3">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
            What happens next
          </p>
          <ul className="mt-2 space-y-1 text-[11px] leading-snug text-slate">
            <li>Your responses were captured securely and deduplicated.</li>
            <li>Our admissions team reviews fit indicators. No child is gated out.</li>
            <li>We will reach out with relevant GT programs and events.</li>
          </ul>
        </div>
      )}

      <a
        href="https://gt.school"
        className={`flex h-11 w-full items-center justify-center rounded-card text-[14px] font-semibold shadow-sm hover:opacity-95 ${
          canDeposit
            ? "mt-3 border border-border bg-surface text-ink"
            : "mt-4 bg-ink-cta text-on-cta"
        }`}
      >
        Explore GT Anywhere
      </a>
      <p className="mono mt-3 text-center text-[10px] text-label">
        This result is a fit indicator to start a conversation, never a verdict on your child.
      </p>
    </div>
  );
}
