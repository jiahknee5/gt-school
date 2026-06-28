// Public GT Challenge landing route (/gifted-quiz). Allow-listed as a PUBLIC_EXACT
// path in lib/auth/policy.ts so the deny-by-default middleware lets a signed-out parent
// reach it. The page itself ships no Hub chrome (see GiftedQuiz.tsx full-bleed overlay).

import type { Metadata } from "next";
import { GiftedQuiz, DEMO_EMAIL, type QuizPrefill } from "./GiftedQuiz";

export const metadata: Metadata = {
  title: "The GT Challenge | GT Anywhere",
  description:
    "Six quick questions about how your child learns. Get an instant fit indicator — a screen to start a conversation, not a gifted test.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

// ?demo=1 (the /ad CTA carries it) prefills a qualifying response so a click straight
// through creates a trackable real lead. Prefill values are static (pure render → no SSR/
// hydration mismatch); the email is made UNIQUE per submission on the client at submit
// time (an event handler, where Date.now() is fine). The public quiz gets no prefill.
export default async function GiftedQuizPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const prefill: QuizPrefill | null =
    query.demo === "1"
      ? {
          scales: { patternReasoning: 5, curiosity: 5, selfDirectedProjects: 5, focusPersistence: 5 },
          readingAboveGrade: true,
          childFirstName: "Harper",
          childGrade: "3",
          parentEmail: DEMO_EMAIL,
          parentPhone: "(512) 555-0143",
          zip: "78704",
          consent: true,
          parentObservation: "She taught herself multiplication from a library book over spring break.",
        }
      : null;
  return <GiftedQuiz prefill={prefill} />;
}
