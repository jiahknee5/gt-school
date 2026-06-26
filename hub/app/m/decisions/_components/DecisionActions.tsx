"use client";

// Leader act controls for one open decision. Posts to the existing Leader-gated
// mutation route (POST /api/decisions/[id]/decide), which re-checks the session and
// runs the state machine server-side. A leadership note is required before any ruling
// (the route enforces it too — this is just a fast client-side guard).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Ruling = "approve" | "reject" | "need_info";

export function DecisionActions({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Ruling | null>(null);
  const [isPending, startTransition] = useTransition();

  async function rule(response: Ruling) {
    setError(null);
    if (!note.trim()) {
      setError("Add a leadership note before ruling.");
      return;
    }
    setBusy(response);
    try {
      const res = await fetch(`/api/decisions/${id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, note: note.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Could not record the ruling (${res.status}).`);
        setBusy(null);
        return;
      }
      setNote("");
      setBusy(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error — the ruling was not recorded.");
      setBusy(null);
    }
  }

  const disabled = busy !== null || isPending;

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <label className="mono text-[11px] font-semibold text-label" htmlFor={`note-${id}`}>
        Leadership note (required)
      </label>
      <textarea
        id={`note-${id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Why this ruling? The submitter sees this note."
        className="mt-1.5 w-full resize-y rounded-card border border-border bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-label focus:border-gold"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => rule("approve")}
          disabled={disabled}
          className="inline-flex h-8 items-center justify-center rounded-card bg-green px-3 text-[12px] font-semibold text-white transition-transform active:translate-y-px disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => rule("reject")}
          disabled={disabled}
          className="inline-flex h-8 items-center justify-center rounded-card bg-red px-3 text-[12px] font-semibold text-white transition-transform active:translate-y-px disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button
          type="button"
          onClick={() => rule("need_info")}
          disabled={disabled}
          className="inline-flex h-8 items-center justify-center rounded-card border border-border bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-hover disabled:opacity-50"
        >
          {busy === "need_info" ? "Sending…" : "Need more info"}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] font-semibold text-red">{error}</p>}
    </div>
  );
}
