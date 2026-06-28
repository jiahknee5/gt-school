// /dev/proof — "show us it works." The four PRD demo proof points, each WATCHABLE and run
// through the REAL production functions (not a canned animation): a payment propagates, the
// budget reconciles to $365K, a role is denied the Decision Queue, and the data-confidence
// banner appears when parity drops. Polish matters less than honesty — every number here is
// the live output of the same code the app runs, READ FROM THE PHASE 1 DB, with a documented
// deterministic seed fallback when the database is unreachable (each card labels its source).

import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import { loadDataset } from "@/lib/seed/load-dataset";
import { readPaymentPropagationSummary, type PaymentWatchRow } from "@/lib/payments/propagation";
import { reconcileBudget } from "@/lib/budget/reconcile";
import { routeDecision } from "@/lib/auth/policy";
import { getBannerState, type BannerState } from "@/lib/parity";
import { seedBannerState, computeSeedParity } from "@/lib/crm-ops/parity-view";
import { BUDGET_TOTAL } from "@/lib/seed/dictionaries";
import type { Role } from "@/lib/phase2";
import { PaymentPropagationPlayer, ParityDropToggle, type PaymentStep } from "./ProofConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proof — show it works | GT Marketing Hub" };

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** A small honest provenance tag: did this proof read the live Phase 1 DB, or the seed twin? */
function SourceBadge({ live, label }: { live: boolean; label: string }) {
  return (
    <span
      className={`mono shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        live ? "bg-green-soft text-green" : "bg-amber-soft text-amber"
      }`}
      title={live ? "Read from the live Phase 1 database." : "Database unreachable — deterministic seed fallback."}
    >
      {live ? "live db" : "seed fallback"} · {label}
    </span>
  );
}

function ProofCard({ n, title, brief, meta, children }: { n: number; title: string; brief: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-cta text-[10px] font-bold text-on-cta">{n}</span>
        <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
        {meta ? <span className="ml-auto">{meta}</span> : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted">{brief}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function DevProofPage() {
  const ds = await loadDataset({ seed: 424242, families: 1200 });

  // ---- Proof 1: a payment propagates (LIVE reader — DB rows, seed fallback) ----
  // readPaymentPropagationSummary() is the SAME reader /dev/payments uses: it queries the
  // Phase 1 DB per program (RLS-scoped) for the event → payment → enrollment → CRM-handoff
  // chain and falls back to the deterministic seed twin when APP_RW_DATABASE_URL is
  // unreachable. It reports which source it actually used (pay.source / pay.sourceLabel).
  const pay = await readPaymentPropagationSummary();
  const dbLive = pay.source === "live-db";
  // A row that fully propagated: succeeded → enrollment flipped paid → (ideally) a replayed event.
  const propagated: PaymentWatchRow | null =
    pay.rows.find((r) => r.paymentStatus === "succeeded" && r.enrollmentPaid && r.idempotentReplayVisible) ??
    pay.rows.find((r) => r.paymentStatus === "succeeded" && r.enrollmentPaid) ??
    pay.selected ??
    pay.idempotency.row ??
    pay.rows.find((r) => r.paymentStatus === "succeeded") ??
    pay.rows[0] ??
    null;

  // The idempotency / replay-no-op signal is computed across the whole summary (the event that
  // was delivered twice), not the single propagated row — so step 6 is the real replay proof.
  const idem = pay.idempotency;
  const replayDetail = `${idem.eventId && idem.eventId !== propagated?.eventId ? `event ${idem.eventId} · ` : ""}${idem.duplicateDeliveries} duplicate deliver${idem.duplicateDeliveries === 1 ? "y" : "ies"} · ${idem.processedLedgerRows} processed-ledger row · ${idem.paymentRowsForIntent} payment row for intent`;

  const paymentSteps: PaymentStep[] = propagated
    ? [
        { label: "Stripe event received", detail: `event ${propagated.eventId ?? "—"} · intent ${propagated.intentId} · ${propagated.deliveries} deliver${propagated.deliveries === 1 ? "y" : "ies"}`, value: propagated.eventStatus, tone: "neutral" },
        { label: "Routed to its program (isolated)", detail: `program ${propagated.programName} · visible to ${propagated.visibleProgramKeys.join(", ") || propagated.programKey} · ${propagated.contaminationStatus}`, value: propagated.contaminationStatus === "isolated" ? "isolated ✓" : "contaminated", tone: propagated.contaminationStatus === "isolated" ? "good" : "watch" },
        { label: "Payment row recorded", detail: `amount ${usd(propagated.amount)} · status rank ${propagated.statusRank} (monotonic)`, value: `${propagated.paymentStatus} ${usd(propagated.amount)}`, tone: "neutral" },
        { label: "Enrollment flips paid", detail: `family ${propagated.familyId ?? "—"} · enrollment ${propagated.enrollmentId ?? "—"} · stage ${propagated.enrollmentStage ?? "—"}`, value: propagated.enrollmentPaid ? "paid = true ✓" : "not paid", tone: propagated.enrollmentPaid ? "good" : "watch" },
        { label: "CRM outbox / HubSpot handoff", detail: `dedupe key ${propagated.outboxDedupeKey ?? "—"} · HubSpot deal ${propagated.hubspotDealId ?? "—"}`, value: propagated.outboxStatus ?? propagated.crmSyncStatus, tone: "good" },
        { label: "Replay same event → no-op (idempotent)", detail: replayDetail, value: idem.replayNoOpVisible ? "no double-charge ✓" : "single delivery", tone: "good" },
      ]
    : [];

  // ---- Proof 2: the budget reconciles to $365K (LIVE budget through reconcileBudget) ----
  // ds.budget_workstream + ds.budget_entry come from loadDataset (the Phase 1 DB). When the
  // DB's budget_entry ledger is empty, the loader synthesizes one committed + one actual entry
  // per workstream FROM the workstream columns (entered_by="system:seed-gap"), so committed /
  // actual are never silently zeroed. The SAME reconcileBudget the Budget module uses rolls
  // the live rows up — the total is not a constant, it is derived and validated to $365K.
  const recon = reconcileBudget(ds.budget_workstream, ds.budget_entry);
  const budgetSynthesized = ds.budget_entry.some((e) => e.entered_by === "system:seed-gap");

  // ---- Proof 3: role denied the Decision Queue (real routeDecision — the production policy) ----
  // routeDecision IS the deny-by-default function the Edge middleware and server guards call;
  // it is evaluated live below for each role against the real /m/decisions path.
  const roles: Role[] = ["admin", "leader", "operator"];
  const rbac = roles.map((role) => ({ role, decision: routeDecision(role, "/m/decisions") }));

  // ---- Proof 4: data-confidence banner appears when parity drops (LIVE banner reader) ----
  // getBannerState() is the actual production reader every HubSpot-consuming module mounts: it
  // reads the latest parity_snapshot from the live DB and classifies below-threshold fields.
  // We call it for the REAL verdict (overall %, the env-configured threshold, freshness); it
  // throws when the DB is unreachable, so we fall back to the pure twin on the (also DB-backed)
  // field_state for the watchable threshold-cross toggle.
  let liveBanner: BannerState | null = null;
  try {
    liveBanner = await getBannerState();
  } catch {
    liveBanner = null;
  }
  const bannerLive = liveBanner != null;
  const policyThreshold = liveBanner?.thresholdPct ?? 95;
  // The worst governed field on the real (DB-backed) field_state → a lenient bar that sits just
  // below it. At the lenient bar nothing is below (healthy, no banner); raise to the policy bar
  // and the real income_band / source / tefa_status parity crosses below → the banner appears.
  const worstPct = computeSeedParity(ds.field_state).fieldDetail[0]?.pct ?? policyThreshold;
  const lenientThreshold = Math.min(Math.floor(worstPct), Math.floor(policyThreshold) - 1);
  const healthy = seedBannerState(ds.field_state, lenientThreshold);
  const dropped = seedBannerState(ds.field_state, policyThreshold);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">Developer · Proof</p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">Show it works — the four proof points</h1>
      <p className="mt-1.5 max-w-[820px] text-[12px] leading-snug text-muted">
        The PRD&apos;s &quot;give us a way to see it working.&quot; Each proof runs the same production function the
        app uses — watch a payment propagate, the budget reconcile to {usd(BUDGET_TOTAL)}, a role be denied the
        Decision Queue, and the data-confidence banner appear when parity drops. Honesty over polish: every value is
        read from the Phase 1 DB, with a documented deterministic seed fallback when the database is unreachable —
        each card shows which source it used.
      </p>

      <DevTabs />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ProofCard n={1} title="A payment propagates" brief="Stripe event → isolated to its program → payment row → enrollment flips paid → CRM handoff → replay is a no-op (idempotent). readPaymentPropagationSummary() is the live reader." meta={<SourceBadge live={dbLive} label={pay.sourceLabel} />}>
          {propagated ? (
            <>
              <PaymentPropagationPlayer steps={paymentSteps} />
              {pay.liveLimitations.length > 0 ? (
                <p className="mono mt-2 text-[9px] leading-snug text-label">{pay.liveLimitations.join(" ")}</p>
              ) : null}
            </>
          ) : (
            <p className="text-[11px] text-muted">No propagated payment row available from {dbLive ? "the live DB" : "the seed twin"}.</p>
          )}
        </ProofCard>

        <ProofCard n={2} title={`The budget reconciles to ${usd(BUDGET_TOTAL)}`} brief="The live budget rows (ds.budget_workstream + ds.budget_entry) roll up to the exact total through reconcileBudget() — the same function the Budget module uses; >10% variance auto-flags the Decision Queue." meta={<SourceBadge live={dbLive} label={budgetSynthesized ? "ds.budget_* · synth ledger" : "ds.budget_*"} />}>
          <div className="space-y-2">
            <div className={`flex items-center justify-between rounded-card border px-3 py-2 ${recon.reconciles ? "border-green/40 bg-green-soft/40" : "border-red-soft bg-red-soft"}`}>
              <span className="text-[12px] font-semibold text-ink">Planned total</span>
              <span className="mono num text-[15px] font-bold text-ink">{usd(recon.totals.planned)}</span>
              <span className={`mono text-[11px] font-bold ${recon.reconciles ? "text-green" : "text-red"}`}>
                {recon.reconciles ? `== ${usd(BUDGET_TOTAL)} ✓` : `≠ ${usd(BUDGET_TOTAL)}`}
              </span>
            </div>
            <p className="mono text-[10px] text-muted">
              recommended {usd(recon.totals.recommended)} · committed {usd(recon.totals.committed)} · actual {usd(recon.totals.actual)} ·{" "}
              {recon.reconcileError ? <span className="text-red">{recon.reconcileError}</span> : "no reconcile errors"}
            </p>
            <div className="rounded-card border border-hairline bg-canvas p-2">
              <p className="mono text-[9px] font-semibold uppercase tracking-wide text-label">&gt;10% variance → auto-flagged ({recon.autoFlagRows.length})</p>
              {recon.autoFlagRows.length ? (
                recon.autoFlagRows.map((r) => (
                  <p key={r.key} className="mt-1 text-[11px] text-ink">
                    {r.name}: actual {usd(r.actual)} vs plan {usd(r.planned)} ·{" "}
                    <span className="font-semibold text-amber">+{r.variancePct.toFixed(0)}%</span>{" "}
                    <Link href="/m/decisions" className="mono text-[10px] font-semibold text-gold hover:underline">→ queue</Link>
                  </p>
                ))
              ) : (
                <p className="mt-1 text-[11px] text-muted">No workstream over the +10% threshold.</p>
              )}
            </div>
            <p className="mono text-[9px] text-label">reconcileBudget throws BudgetValidationError if the rows don&apos;t sum to {usd(BUDGET_TOTAL)} — the total can&apos;t silently drift.</p>
            <p className="mono text-[9px] leading-snug text-label">
              {budgetSynthesized
                ? "Live budget_entry ledger was empty → committed/actual synthesized per workstream from the budget_workstream columns (entered_by=system:seed-gap), so the split is the real DB budget, not zero."
                : `Rolled up from ${ds.budget_entry.length} live budget_entry rows across ${ds.budget_workstream.length} workstreams.`}
            </p>
          </div>
        </ProofCard>

        <ProofCard n={3} title="A role is denied the Decision Queue" brief="routeDecision(role, /m/decisions) — the real deny-by-default policy the Edge middleware and server guards call, evaluated live below. Leader-only view+act; Admin and Operator are both denied with the exact reason." meta={<span className="mono shrink-0 rounded-[4px] bg-side px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-label" title="Pure RBAC policy function — no DB; evaluated live for each role.">live policy fn</span>}>
          <div className="overflow-hidden rounded-card border border-hairline">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-side">
                  {["Role", "/m/decisions", "Reason"].map((h) => (
                    <th key={h} className="mono px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-label">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rbac.map(({ role, decision }) => (
                  <tr key={role} className="border-b border-hairline last:border-0 align-top">
                    <td className="mono px-2 py-1 text-[11px] font-semibold text-slate">{role}</td>
                    <td className="px-2 py-1">
                      <span className={`mono rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase ${decision.allowed ? "bg-green-soft text-green" : "bg-red-soft text-red"}`}>
                        {decision.allowed ? "allowed 200" : `denied ${decision.status}`}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-[10px] leading-snug text-muted">{decision.reason}{decision.redirectTo ? ` → ${decision.redirectTo}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mono mt-2 text-[9px] text-label">Enforced at 3 layers: Edge middleware · the page server-check · the sidebar hide. Try it live: sign in as Operator and open <Link href="/m/decisions" className="text-gold hover:underline">/m/decisions</Link>.</p>
        </ProofCard>

        <ProofCard n={4} title="The data-confidence banner appears when parity drops" brief="getBannerState() — the live reader every HubSpot-consuming module mounts — on the real DB parity. Raise the bar from lenient to the policy threshold and the genuinely-below governed fields cross it → the shared banner appears." meta={<SourceBadge live={bannerLive} label={bannerLive ? "getBannerState()" : "field_state twin"} />}>
          <ParityDropToggle healthy={healthy} dropped={dropped} />
          {liveBanner ? (
            <p className="mono mt-2 text-[9px] leading-snug text-label">
              Live reader verdict: overall {liveBanner.overallPct}% · {liveBanner.below.length} field{liveBanner.below.length === 1 ? "" : "s"} below the {liveBanner.thresholdPct}% bar{liveBanner.alarm ? " · ALARM (a surprise field dropped)" : liveBanner.below.length ? " · all calm (known-unreliable)" : ""}
              {liveBanner.takenAt ? ` · snapshot ${new Date(liveBanner.takenAt).toLocaleString("en-US")}` : " · computed live (no snapshot yet)"}.
            </p>
          ) : (
            <p className="mono mt-2 text-[9px] leading-snug text-label">
              Live getBannerState() unavailable (DB unreachable) — toggle shows the pure twin on the DB-backed field_state at the {policyThreshold}% policy bar.
            </p>
          )}
        </ProofCard>
      </div>

      <footer className="mt-5 border-t border-hairline pt-3 text-[11px] text-label">
        Each proof is also covered by tests (<span className="mono">brief-usecases.test.ts</span>,{" "}
        <span className="mono">payments.test.ts</span>, <span className="mono">budget.test.ts</span>,{" "}
        <span className="mono">rbac.test.ts</span>, <span className="mono">parity.test.ts</span>) — this page is the watchable view of the same logic.
      </footer>
    </div>
  );
}
