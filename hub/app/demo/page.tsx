// /demo — the simplified, one-page walkthrough of the WHOLE pipeline for a single record:
// ad → form → Stripe payment → database → synced on the hub → shown in the payment log.
// Each step shows the NEW key minted there (and the keys carried in) with a date/time, so
// you can trace the identifier chain that ends in the Event/payment ledger. Reads the LIVE
// DB (lib/demo/journey.ts) — nothing seeded or faked.

import Link from "next/link";
import { loadDemoFlow, latestDemoKey, type DemoStep, type DemoKey } from "@/lib/demo/journey";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live demo — ad → form → Stripe → hub | GT" };

function fmtAt(at: string | null): string {
  if (!at) return "—";
  const t = Date.parse(at);
  if (Number.isNaN(t)) return "—";
  // GT is in Austin — show timestamps in Central Time (CST/CDT), not UTC.
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(t);
}

function KeyChip({ k }: { k: DemoKey }) {
  return (
    <div
      className={`rounded-card border p-2 ${k.fresh ? "border-gold/50 bg-paper" : "border-hairline bg-fill"}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="mono text-[10px] font-semibold text-label">{k.label}</span>
        {k.fresh && (
          <span className="mono rounded-[3px] bg-gold/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-gold">
            new
          </span>
        )}
      </div>
      {k.href ? (
        <a href={k.href} target="_blank" rel="noopener noreferrer" className="mono mt-0.5 block break-all text-[11px] leading-snug font-semibold text-gold hover:underline">
          {k.value} ↗
        </a>
      ) : (
        <p className="mono mt-0.5 break-all text-[11px] leading-snug text-ink">{k.value}</p>
      )}
    </div>
  );
}

function StepCard({ step, last }: { step: DemoStep; last: boolean }) {
  const done = step.done;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`mono grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
            done ? "border-green bg-green-soft text-green" : "border-hairline bg-fill text-label"
          }`}
        >
          {step.n}
        </span>
        {!last && <span className={`mt-0.5 h-full w-px flex-1 ${done ? "bg-green/40" : "bg-border"}`} />}
      </div>
      <div className={`mb-3 min-w-0 flex-1 rounded-card border bg-surface p-3 shadow-sm ${done ? "border-green/30" : "border-hairline"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{step.label}</span>
          <span className={`mono rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${done ? "bg-green-soft text-green" : "bg-fill text-label"}`}>
            {done ? "done" : "pending"}
          </span>
          <span className="mono ml-auto text-[10px] text-label">{fmtAt(step.at)}</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">{step.summary}</p>
        {step.keys.length > 0 && (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {step.keys.map((k) => (
              <KeyChip key={`${step.n}-${k.label}`} k={k} />
            ))}
          </div>
        )}
        {step.href && (
          <Link href={step.href} className="mono mt-2 inline-block text-[10px] font-semibold text-gold hover:underline">
            → see it in {step.hrefLabel ?? "the app"}
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const q = searchParams ? await searchParams : {};
  const key = (q.key && String(q.key)) || (await latestDemoKey().catch(() => null));
  const flow = key ? await loadDemoFlow(key).catch(() => null) : null;

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[760px] px-6 py-7">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">Live pipeline demo</p>
          <h1 className="mt-1 font-serif text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {flow ? `${flow.childName}'s record, end to end` : "Watch one record flow through the system"}
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[12px] leading-snug text-muted">
            One real record, HubSpot-first: <span className="font-semibold text-ink">ad → form → Stripe payment → HubSpot (CRM, written first) → synced to the database → shown in the payment log</span>.
            Each step shows the new key minted there (with a timestamp) — the{" "}
            <span className="mono text-ink">hubspot_contact_id</span> / <span className="mono text-ink">hubspot_deal_id</span> link straight into HubSpot.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href="/ad"
              className="inline-flex h-10 items-center justify-center rounded-card bg-ink-cta px-5 text-[13px] font-semibold text-on-cta shadow-sm transition-transform active:translate-y-px"
            >
              Start from the ad →
            </Link>
            <span className="mono text-[10px] text-label">ad → prefilled form → pay the deposit → land here</span>
          </div>
          {flow && (
            <p className="mono mt-3 break-all text-[10px] text-label">
              record {flow.familyId} · {flow.email ?? "no email"} · match_key {flow.matchKey ?? "—"}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[760px] px-6 py-6">
        {flow ? (
          <ol className="flex flex-col">
            {flow.steps.map((s, i) => (
              <StepCard key={s.n} step={s} last={i === flow.steps.length - 1} />
            ))}
          </ol>
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-6 text-center">
            <p className="text-[12px] text-muted">
              No record yet. <Link href="/ad" className="font-semibold text-gold hover:underline">Start from the ad</Link>,
              take the prefilled quiz, and pay the deposit — then this page shows that record&apos;s key chain.
            </p>
          </div>
        )}
        <p className="mono mt-4 border-t border-hairline pt-3 text-[10px] text-label">
          Reads the live DB via lib/demo/journey.ts · real Stripe test payment · the payment log is /dev/payments.
        </p>
      </div>
    </main>
  );
}
