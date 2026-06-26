// Public GT Challenge landing route (/gifted-quiz). Allow-listed as a PUBLIC_EXACT
// path in lib/auth/policy.ts so the deny-by-default middleware lets a signed-out parent
// reach it. The page itself ships no Hub chrome (see GiftedQuiz.tsx full-bleed overlay).

import type { Metadata } from "next";
import { GiftedQuiz } from "./GiftedQuiz";

export const metadata: Metadata = {
  title: "The GT Challenge | GT Anywhere",
  description:
    "Six quick questions about how your child learns. Get an instant fit indicator — a screen to start a conversation, not a gifted test.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default function GiftedQuizPage() {
  return <GiftedQuiz />;
}
