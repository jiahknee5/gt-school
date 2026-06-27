"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";

// Short chip labels keep the row compact; the full question is what's sent to the model.
const CHIPS = [
  { label: "Behind on deposits?", q: "Why are we behind on Fall deposits?" },
  { label: "Worst CPQL?", q: "Which channel has the worst CPQL?" },
  { label: "Blocking decision?", q: "What decision is blocking conversion?" },
];

interface AskCitation {
  title: string;
  href: string;
}

interface AskResult {
  answer: string;
  source: string;
  citations: AskCitation[];
  actions: string[];
  note?: string;
  refused?: { reason: string; saferAlternative: string };
}

export function AskTheHubStrip({ week }: { week?: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/status/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: trimmed, week }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Could not answer right now.");
          setResult(null);
        } else {
          setResult(data as AskResult);
        }
      } catch {
        setError("Network error — try again.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [loading, week],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(query);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-l border-hairline pl-5">
      <span
        className="font-serif text-[13px] font-bold text-ink"
        title="Answers inline · grounded in this week's verdict"
      >
        Ask the Hub
      </span>
      <form onSubmit={onSubmit} className="flex gap-1.5">
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
          disabled={loading}
          className="grid min-h-7 min-w-7 place-items-center rounded-card bg-ink-cta text-[12px] text-on-cta disabled:opacity-50"
          aria-label="Ask the Hub"
        >
          {loading ? "…" : "▶"}
        </button>
      </form>
      <div className="flex flex-wrap gap-1">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            title={chip.q}
            onClick={() => {
              setQuery(chip.q);
              void ask(chip.q);
            }}
            className="rounded-full border border-border bg-surface px-2 py-0.5 text-left text-[10px] font-medium text-slate hover:border-slate hover:bg-hover"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error && <p className="mono text-[10px] text-red">{error}</p>}

      {result && (
        <div className="mt-1 rounded-card border border-border bg-canvas p-2.5 text-[11px] leading-snug">
          <p className="text-ink">{result.answer}</p>
          {result.refused && (
            <p className="mt-1.5 text-[10px] italic text-amber">{result.refused.saferAlternative}</p>
          )}
          {result.actions?.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {result.actions.map((a) => (
                <li key={a} className="flex gap-1.5 text-[10px] text-muted">
                  <span aria-hidden="true" className="text-gold">
                    →
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          )}
          {result.citations?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-hairline pt-1.5">
              {result.citations.map((c) => (
                <Link
                  key={`${c.title}-${c.href}`}
                  href={c.href}
                  className="mono text-[9px] font-semibold text-gold hover:underline"
                >
                  {c.title} ↗
                </Link>
              ))}
            </div>
          )}
          {result.note && <p className="mono mt-1.5 text-[9px] italic text-muted">{result.note}</p>}
        </div>
      )}
    </div>
  );
}
