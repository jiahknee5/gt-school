/**
 * ask.ts — deterministic, status-snapshot-grounded answers for the inline
 * "Ask the Hub" strip on the Status page. These cover the example questions with
 * REAL numbers from the current (or selected-week) board, with no LLM key required.
 * Anything not matched here is handed to the full Ask-the-Hub agent (lib/ai/agents).
 */

import type { StatusBoard } from "./board";

export interface StatusAskCitation {
  title: string;
  href: string;
}

export interface StatusAskResult {
  matched: boolean;
  answer: string;
  citations: StatusAskCitation[];
  actions: string[];
}

function includesAny(q: string, needles: string[]): boolean {
  return needles.some((n) => q.includes(n));
}

const STATUS_CITATION: StatusAskCitation = { title: "Status — exec verdict board", href: "/m/status" };

export function answerStatusQuestion(board: StatusBoard, rawQuestion: string): StatusAskResult {
  const q = rawQuestion.toLowerCase().trim();
  const ns = board.northStar;
  const conv = board.stages.find((s) => s.key === "conversion");
  const nurture = board.stages.find((s) => s.key === "nurture");
  const acquisition = board.stages.find((s) => s.key === "acquisition");

  // Why behind on deposits / are we on track?
  if (includesAny(q, ["behind", "on track", "deposit", "fall", "pace"]) && !includesAny(q, ["channel", "cpql", "cac"])) {
    const onTrack = ns.gap >= 0 && board.answer.rag !== "red";
    return {
      matched: true,
      answer:
        `${board.answer.headline} Deposits sit at ${ns.current}/${ns.target} (${ns.pctOfTarget}% of goal), ` +
        `${ns.gap >= 0 ? "+" : ""}${ns.gap} versus linear pace, closing ${ns.weeklyActual}/wk against the ${ns.weeklyRequired}/wk needed` +
        `${ns.projection < ns.target ? `, projecting ${ns.projection} of ${ns.target}` : ""}. ` +
        `${onTrack ? "Demand is not the constraint — defend conversion and SLA." : "Conversion, not demand, is the binding constraint before Aug 17."}`,
      citations: [STATUS_CITATION, { title: "Dashboard — Goal pacing", href: "/m/dashboard?tab=pacing" }],
      actions: [
        "Open the Conversion row to see the offer→deposit leak.",
        `Watch the ${board.daysToCutoff}-day clock to the Aug 17 Fall cutoff.`,
      ],
    };
  }

  // Worst CPQL / channel efficiency
  if (includesAny(q, ["cpql", "channel", "cac", "efficien"])) {
    const bars = acquisition?.drivers.rankedBars ?? [];
    const trap = bars.find((b) => b.tag === "trap") ?? bars[bars.length - 1];
    const best = bars.find((b) => b.volume === "best") ?? bars[0];
    return {
      matched: true,
      answer:
        `${trap ? `${trap.label} runs the worst CPQL (${trap.displayValue}) — paid social volume that doesn't convert.` : "Paid social runs the worst CPQL."} ` +
        `${best ? `${best.label} is the most efficient line.` : ""} ` +
        `Note: exact CAC-by-channel is not trustworthy while UTM attribution is flagged — read this directionally.`,
      citations: [STATUS_CITATION, { title: "CRM Ops — sync parity / UTM", href: "/m/crm-ops" }],
      actions: ["Shift spend from the trap line toward the best-converting owned channel.", "Clear the UTM parity issue before quoting exact CAC."],
    };
  }

  // What decision is blocking conversion / what needs me?
  if (includesAny(q, ["decision", "blocking", "approve", "needs you", "what should"])) {
    const dec = conv?.decisions.decision;
    return {
      matched: true,
      answer: dec
        ? `The conversion-stage decision awaiting leadership is: "${dec.question}". ` +
          `${board.openDecisionCount} decision${board.openDecisionCount === 1 ? "" : "s"} total await a ruling in the queue.`
        : `No conversion-specific decision is open right now; ${board.openDecisionCount} decision${board.openDecisionCount === 1 ? "" : "s"} await leadership across the queue.`,
      citations: [STATUS_CITATION, { title: "Decision Queue", href: "/m/decisions" }],
      actions: ["Open the Decision Queue to rule with a note.", "Check the Conversion row drawer for the linked ask."],
    };
  }

  // Speed-to-lead / SLA
  if (includesAny(q, ["sla", "speed-to-lead", "speed to lead", "follow up", "follow-up", "late"])) {
    const sla = nurture?.position.stat;
    return {
      matched: true,
      answer:
        `${nurture?.narrative.bullets?.[0]?.text ?? "Speed-to-lead is the nurture risk."} ` +
        `${sla ? `Current 24h SLA reads ${sla.value} (${sla.delta}).` : ""} This is a deterministic stand-in, not live HubSpot.`,
      citations: [STATUS_CITATION, { title: "Nurture — SLA & sequences", href: "/m/nurture" }],
      actions: ["Assign an owner to close the late-follow-up gap.", "Open the Nurture row for the SLA trend."],
    };
  }

  return { matched: false, answer: "", citations: [], actions: [] };
}
