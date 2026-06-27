// /dev/proof — "show us it works." The four PRD demo proof points, each WATCHABLE and run
// through the REAL production functions (not a canned animation): a payment propagates, the
// budget reconciles to $365K, a role is denied the Decision Queue, and the data-confidence
// banner appears when parity drops. Polish matters less than honesty — every number here is
// the live output of the same code the app runs.

import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import { generate } from "@/lib/seed/generate";
import { buildSeedPaymentPropagationSummary, type PaymentWatchRow } from "@/lib/payments/propagation";
import { reconcileBudget } from "@/lib/budget/reconcile";
import { routeDecision } from "@/lib/auth/policy";
import { seedBannerState } from "@/lib/crm-ops/parity-view";
import { BUDGET_TOTAL } from "@/lib/seed/dictionaries";
import type { Role } from "@/lib/phase2";
import { PaymentPropagationPlayer, ParityDropToggle, type PaymentStep } from "./ProofConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proof — show it works | GT Marketing Hub" };

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function ProofCard({ n, title, brief, children }: { n: number; title: string; brief: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-3.5 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-cta text-[10px] font-bold text-on-cta">{n}</span>
        <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted">{brief}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function DevProofPage() {
  const ds = generate({ seed: 424242, families: 1200 });

  // ---- Proof 1: payment propagates (real propagation summary) ----
  const pay = buildSeedPaymentPropagationSummary(ds);
  // Pick a row that fully propagated: succeeded → enrollment flipped paid → outbox enqueued.
  const propagated: PaymentWatchRow | null =
    pay.rows.find((r) => r.paymentStatus === "succeeded" && r.enrollmentPaid && r.outboxStatus) ??
    pay.idempotency.row ??
    pay.rows.find((r) => r.paymentStatus === "succeeded") ??
    pay.rows[0] ??
    null;
  const paymentSteps: PaymentStep[] = propagated
    ? [
        { label: "Stripe event received", detail: `event ${propagated.eventId ?? "—"} · intent ${propagated.intentId} · ${propagated.deliveries} deliver${propagated.deliveries === 1 ? "y" : "ies"}`, value: propagated.eventStatus, tone: "neutral" },
        { label: "Routed to its program (isolated)", detail: `program ${propagated.programName} · visible to ${propagated.visibleProgramKeys.join(", ") || propagated.programKey} · ${propagated.contaminationStatus}`, value: propagated.contaminationStatus === "isolated" ? "isolated ✓" : "contaminated", tone: propagated.contaminationStatus === "isolated" ? "good" : "watch" },
        { label: "Payment row recorded", detail: `amount ${usd(propagated.amount)} · status rank ${propagated.statusRank} (monotonic)`, value: `${propagated.paymentStatus} ${usd(propagated.amount)}`, tone: "neutral" },
        { label: "Enrollment flips paid", detail: `family ${propagated.familyId ?? "—"} · enrollment ${propagated.enrollmentId ?? "—"} · stage ${propagated.enrollmentStage ?? "—"}`, value: propagated.enrollmentPaid ? "paid = true ✓" : "not paid", tone: propagated.enrollmentPaid ? "good" : "watch" },
        { label: "CRM outbox enqueued (deduped)", detail: `dedupe key ${propagated.outboxDedupeKey ?? "—"} · HubSpot deal ${propagated.hubspotDealId ?? "—"}`, value: propagated.outboxStatus ?? "—", tone: "good" },
        { label: "Replay same event → no-op (idempotent)", detail: `${propagated.duplicateDeliveries} duplicate deliveries · ${propagated.processedLedgerRows} processed-ledger row · ${propagated.paymentRowsForIntent} payment row for intent`, value: propagated.idempotentReplayVisible ? "no double-charge ✓" : "—", tone: "good" },
      ]
    : [];

  // ---- Proof 2: budget reconciles to $365K (real reconcile) ----
  const recon = reconcileBudget(ds.budget_workstream, ds.budget_entry);

  // ---- Proof 3: role denied the Decision Queue (real routeDecision) ----
  const roles: Role[] = ["admin", "leader", "operator"];
  const rbac = roles.map((role) => ({ role, decision: routeDecision(role, "/m/decisions") }));

  // ---- Proof 4: data-confidence banner appears when parity drops (real banner state) ----
  // Same real parity data; at a lenient 80% bar nothing is below (healthy, no banner); at the
  // policy 95% bar the real income_band/source/tefa_status parity falls below → banner appears.
  const healthy = seedBannerState(ds.field_state, 80);
  const dropped = seedBannerState(ds.field_state, 95);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">Developer · Proof</p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">Show it works — the four proof points</h1>
      <p className="mt-1.5 max-w-[820px] text-[12px] leading-snug text-muted">
        The PRD&apos;s &quot;give us a way to see it working.&quot; Each proof runs the same production function the
        app uses — watch a payment propagate, the budget reconcile to {usd(BUDGET_TOTAL)}, a role be denied the
        Decision Queue, and the data-confidence banner appear when parity drops. Honesty over polish: every value is live.
      </p>

      <DevTabs />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ProofCard n={1} title="A payment propagates" brief="Stripe event → isolated to its program → payment row → enrollment flips paid → CRM outbox enqueued → replay is a no-op (idempotent).">
          {propagated ? (
            <PaymentPropagationPlayer steps={paymentSteps} />
          ) : (
            <p className="text-[11px] text-muted">No propagated payment row in the seed.</p>
          )}
        </ProofCard>

        <ProofCard n={2} title={`The budget reconciles to ${usd(BUDGET_TOTAL)}`} brief="Every workstream rolls up to the exact total; >10% variance auto-flags the Decision Queue. reconcileBudget() is the live function.">
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
          </div>
        </ProofCard>

        <ProofCard n={3} title="A role is denied the Decision Queue" brief="routeDecision(role, /m/decisions) — the real policy. Leader-only view+act; Admin and Operator are both denied with the exact reason.">
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

        <ProofCard n={4} title="The data-confidence banner appears when parity drops" brief="seedBannerState() on the real field parity. Drop a governed field below the confidence bar and watch the shared banner — the one every HubSpot-consuming module mounts — appear.">
          <ParityDropToggle healthy={healthy} dropped={dropped} />
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
