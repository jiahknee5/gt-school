// The funnel entry point — a public "ad" landing page (the creative + CTA). Clicking through
// carries the UTM into the quiz, so the captured lead is attributed source=ad. This is the
// start of the watchable end-to-end slice: ad → quiz → Stripe deposit → tracked in the Hub.

import Link from "next/link";

export const metadata = {
  title: "Is your child gifted? — GT School",
};

const QUIZ_HREF = "/gifted-quiz?utm_source=ad&utm_medium=paid_social&utm_campaign=gifted_quiz_2026";

export default function AdLandingPage() {
  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_60%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
          <p className="mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">GT School · Gifted &amp; Talented</p>
          <h1 className="mt-3 font-serif text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Is your child ready for more than school is giving them?
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
            Take the free 2-minute Gifted Readiness Quiz. Get an instant read on where your child
            stands — and, if they qualify, secure a Fall enrollment spot today.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <Link
              href={QUIZ_HREF}
              className="inline-flex h-12 items-center justify-center rounded-card bg-ink-cta px-7 text-[15px] font-semibold text-on-cta shadow-sm transition-transform active:translate-y-px"
            >
              Take the free quiz →
            </Link>
            <span className="mono text-[10px] text-label">2 minutes · no account needed · instant result</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-6 py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Free & instant", "Answer a few questions, get your child's readiness bucket on the spot."],
            ["Built for gifted kids", "A K-8 microschool for gifted learners — 2-hour learning, mastery-based."],
            ["Spots are limited", "Fall enrollment closes Aug 17. Qualified families can deposit immediately."],
          ].map(([h, b]) => (
            <div key={h} className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <p className="text-[13px] font-semibold text-ink">{h}</p>
              <p className="mt-1 text-[12px] leading-snug text-muted">{b}</p>
            </div>
          ))}
        </div>
        <p className="mono mt-8 text-center text-[10px] text-label">
          Demo funnel · this ad → quiz → Stripe deposit → tracked live in the Marketing Hub.
        </p>
      </section>
    </main>
  );
}
