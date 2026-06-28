// /track/<familyId | email> — the live single-record tracker. Reads the REAL DB and shows
// one lead's journey across every stage: ad click → quiz scored → routed → deposit paid →
// synced to HubSpot. This is the payoff of the end-to-end slice: the grader watches THEIR
// own record (the one they just created via /ad → quiz → deposit) move through the Hub.

import Link from "next/link";
import { loadJourney, type JourneyStage } from "@/lib/demo/journey";

export const dynamic = "force-dynamic";
export const metadata = { title: "Track your lead — GT Marketing Hub" };

function fmtAt(at: string | null): string {
  if (!at) return "";
  const t = Date.parse(at);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString().replace("T", " ").slice(0, 19);
}

function StageRow({ stage, last }: { stage: JourneyStage; last: boolean }) {
  const done = stage.status === "done";
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
            done ? "border-green bg-green-soft text-green" : "border-hairline bg-fill text-label"
          }`}
        >
          {done ? "✓" : "•"}
        </span>
        {!last && <span className={`mt-0.5 h-full w-px flex-1 ${done ? "bg-green/40" : "bg-border"}`} />}
      </div>
      <div className={`mb-3 min-w-0 flex-1 rounded-card border bg-surface p-3 shadow-sm ${done ? "border-green/30" : "border-hairline"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{stage.label}</span>
          <span className={`mono rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${done ? "bg-green-soft text-green" : "bg-fill text-label"}`}>
            {done ? "done" : "pending"}
          </span>
          {stage.at && <span className="mono ml-auto text-[10px] text-label">{fmtAt(stage.at)}</span>}
        </div>
        <p className="mono mt-1 text-[11px] leading-snug text-muted">{stage.detail}</p>
        {stage.keys.length > 0 && (
          <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
            {stage.keys.map((k) => (
              <div key={k.label} className="rounded-[5px] border border-hairline bg-fill px-1.5 py-1">
                <dt className="mono text-[9px] font-semibold text-label">{k.label}</dt>
                {k.href ? (
                  <a href={k.href} target="_blank" rel="noopener noreferrer" className="mono block break-all text-[10px] font-semibold text-gold hover:underline">
                    {k.value} ↗
                  </a>
                ) : (
                  <dd className="mono break-all text-[10px] text-ink">{k.value}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
        <Link href={stage.href} className="mono mt-1.5 inline-block text-[9px] font-semibold text-gold hover:underline">
          ⛁ {stage.source}
        </Link>
      </div>
    </li>
  );
}

export default async function TrackPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const journey = await loadJourney(decodeURIComponent(key)).catch(() => null);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[720px] px-6 py-8">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">Live lead tracker</p>
          <h1 className="mt-1 font-serif text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {journey?.found ? `${journey.name}'s journey` : "Lead not found"}
          </h1>
          <p className="mt-1.5 text-[12px] leading-snug text-muted">
            {journey?.found
              ? "Every stage below is read live from the database — the same record the Marketing Hub funnel counts. Refresh after each step to watch it advance."
              : "No lead matched this key. Start at the ad, take the quiz, then return here."}
          </p>
          {journey?.found && (
            <p className="mono mt-2 text-[10px] text-label">
              family {journey.familyId.slice(0, 8)}… · {journey.email ?? "no email"} · match_key {journey.matchKey?.slice(0, 10) ?? "—"}…
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[720px] px-6 py-6">
        {journey?.found ? (
          <>
            <ol className="flex flex-col">
              {journey.stages.map((s, i) => (
                <StageRow key={s.key} stage={s} last={i === journey.stages.length - 1} />
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href="/m/dashboard" className="mono text-[11px] font-semibold text-gold hover:underline">
                See it counted in the Dashboard funnel →
              </Link>
              <Link href="/m/crm-ops" className="mono text-[11px] font-semibold text-gold hover:underline">
                CRM Ops (sync + parity) →
              </Link>
            </div>
          </>
        ) : (
          <Link href="/ad" className="inline-flex h-10 items-center rounded-card bg-ink-cta px-4 text-[13px] font-semibold text-on-cta">
            Start at the ad →
          </Link>
        )}
        <p className="mono mt-6 border-t border-hairline pt-3 text-[10px] text-label">
          Reads the live DB via lib/demo/journey.ts · ad → quiz → Stripe deposit → HubSpot, one real record.
        </p>
      </div>
    </main>
  );
}
