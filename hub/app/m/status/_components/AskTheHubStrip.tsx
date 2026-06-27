"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const CHIPS = [
  "Why are we behind on Fall deposits?",
  "Which channel has the worst CPQL?",
  "What decision is blocking conversion?",
];

function askHref(query?: string) {
  const trimmed = query?.trim();
  if (!trimmed) return "/help/ai-agents";
  return `/help/ai-agents?q=${encodeURIComponent(trimmed)}`;
}

export function AskTheHubStrip() {
  const [query, setQuery] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    window.location.assign(askHref(query));
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-l border-hairline pl-5">
      <span className="font-serif text-[13px] font-bold text-ink">Ask the Hub</span>
      <span className="mono text-[9px] uppercase tracking-wide text-muted">
        Growth Strategy Agent ·{" "}
        <Link href="/help/ai-agents" className="text-gold hover:underline">
          open console
        </Link>
      </span>
      <form onSubmit={onSubmit} className="mt-1 flex gap-1.5">
        <label htmlFor="status-ask" className="sr-only">
          Ask the Hub
        </label>
        <input
          id="status-ask"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about deposits, channels, decisions…"
          className="min-h-7 flex-1 rounded-card border border-border bg-canvas px-2.5 text-[12px] text-ink focus:border-slate focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="submit"
          className="grid min-h-7 min-w-7 place-items-center rounded-card bg-ink-cta text-[12px] text-on-cta"
          aria-label="Send to Ask the Hub"
        >
          ▶
        </button>
      </form>
      <div className="flex flex-wrap gap-1">
        {CHIPS.map((chip) => (
          <Link
            key={chip}
            href={askHref(chip)}
            className="rounded-full border border-border bg-surface px-2 py-0.5 text-left text-[10px] font-medium text-slate hover:border-slate hover:bg-hover"
          >
            {chip}
          </Link>
        ))}
      </div>
    </div>
  );
}
