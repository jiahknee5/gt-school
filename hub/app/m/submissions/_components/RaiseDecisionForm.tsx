"use client";

// Raise a decision — the SUBMIT control every authenticated role gets (PRD §2). Posts to
// POST /api/decisions/raise (open to any role; carved out of the Leader-only queue), then
// refreshes so the new raise shows immediately in this page's list. It opens a small
// inline form (no heavyweight modal) and can pre-fill from ?intent= params handed off by a
// module (e.g. a Budget variance reallocation a non-leader can't open in the Leader queue).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface RaisePrefill {
  question?: string;
  workstream?: string;
  budget_ask?: string;
  recommendation?: string;
  priority?: string;
}

export function RaiseDecisionForm({ prefill }: { prefill?: RaisePrefill }) {
  const router = useRouter();
  const hasPrefill = Boolean(prefill && Object.values(prefill).some(Boolean));
  const [open, setOpen] = useState(hasPrefill);
  const [question, setQuestion] = useState(prefill?.question ?? "");
  const [workstream, setWorkstream] = useState(prefill?.workstream ?? "");
  const [budgetAsk, setBudgetAsk] = useState(prefill?.budget_ask ?? "");
  const [recommendation, setRecommendation] = useState(prefill?.recommendation ?? "");
  const [priority, setPriority] = useState(prefill?.priority ?? "normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    if (!question.trim()) {
      setError("Describe the decision you need leadership to rule on.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/decisions/raise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          workstream: workstream.trim() || undefined,
          budget_ask: budgetAsk.trim() || undefined,
          recommendation: recommendation.trim() || undefined,
          priority,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Could not raise the decision (${res.status}).`);
        setBusy(false);
        return;
      }
      setQuestion("");
      setWorkstream("");
      setBudgetAsk("");
      setRecommendation("");
      setPriority("normal");
      setBusy(false);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error — the decision was not raised.");
      setBusy(false);
    }
  }

  const disabled = busy || isPending;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px"
      >
        + Raise a decision
      </button>
    );
  }

  return (
    <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Raise a decision</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mono text-[11px] font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted">
        Submitted to leadership. You&apos;ll see your raise and their response below — you never see the full
        queue.
      </p>

      <div className="mt-3 space-y-2.5">
        <div>
          <label htmlFor="raise-question" className="mono text-[10px] font-semibold text-label">
            Decision needed (required)
          </label>
          <textarea
            id="raise-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="e.g. Approve a $4,800 reallocation from Foundations to Guerrilla for the Austin test?"
            className="mt-1 w-full resize-y rounded-card border border-border bg-canvas px-2.5 py-2 text-[12px] text-ink outline-none placeholder:text-label focus:border-gold"
          />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div>
            <label htmlFor="raise-workstream" className="mono text-[10px] font-semibold text-label">
              Workstream (optional)
            </label>
            <input
              id="raise-workstream"
              value={workstream}
              onChange={(e) => setWorkstream(e.target.value)}
              placeholder="guerrilla"
              className="mt-1 h-8 w-full rounded-card border border-border bg-canvas px-2 text-[12px] text-ink outline-none placeholder:text-label focus:border-gold"
            />
          </div>
          <div>
            <label htmlFor="raise-ask" className="mono text-[10px] font-semibold text-label">
              Budget ask $ (optional)
            </label>
            <input
              id="raise-ask"
              inputMode="numeric"
              value={budgetAsk}
              onChange={(e) => setBudgetAsk(e.target.value)}
              placeholder="4800"
              className="mono num mt-1 h-8 w-full rounded-card border border-border bg-canvas px-2 text-[12px] text-ink outline-none placeholder:text-label focus:border-gold"
            />
          </div>
          <div>
            <label htmlFor="raise-priority" className="mono text-[10px] font-semibold text-label">
              Priority
            </label>
            <select
              id="raise-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 h-8 w-full rounded-card border border-border bg-canvas px-2 text-[12px] text-ink outline-none focus:border-gold"
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="raise-recommendation" className="mono text-[10px] font-semibold text-label">
            Your recommendation (optional)
          </label>
          <textarea
            id="raise-recommendation"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={2}
            maxLength={600}
            placeholder="What you'd do and why — context helps leadership rule faster."
            className="mt-1 w-full resize-y rounded-card border border-border bg-canvas px-2.5 py-2 text-[12px] text-ink outline-none placeholder:text-label focus:border-gold"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="inline-flex h-8 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px disabled:opacity-50"
        >
          {disabled ? "Submitting…" : "Submit to leadership"}
        </button>
        {error && <p className="text-[12px] font-semibold text-red">{error}</p>}
      </div>
    </section>
  );
}
