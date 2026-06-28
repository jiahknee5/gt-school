"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// One click runs the whole live pipeline (capture → real Stripe test deposit → DB) and
// lands on /demo?key=… so the freshly-minted key chain renders.
export function RunButton({ label = "Run the live demo" }: { label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setState("running");
    setErr(null);
    try {
      const res = await fetch("/api/demo/run", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setState("error");
        setErr(typeof body?.error === "string" ? body.error : "Run failed.");
        return;
      }
      router.push(`/demo?key=${encodeURIComponent(String(body.key))}`);
      router.refresh();
    } catch {
      setState("error");
      setErr("Couldn't reach the server. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={state === "running"}
        className="inline-flex h-10 items-center justify-center rounded-card bg-ink-cta px-5 text-[13px] font-semibold text-on-cta shadow-sm transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "running" ? "Running the pipeline…" : label}
      </button>
      {err && <p className="mono text-[11px] font-semibold text-red">{err}</p>}
    </div>
  );
}
