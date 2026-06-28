import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import {
  readPaymentPropagationSummary,
  type CrmSyncStatus,
  type PaymentWatchRow,
} from "@/lib/payments/propagation";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<string, string> = {
  processed: "bg-green-soft text-green",
  succeeded: "bg-green-soft text-green",
  refunded: "bg-violet-soft text-violet",
  failed: "bg-red-soft text-red",
  requires_payment: "bg-amber-soft text-amber",
  "missing-ledger": "bg-red-soft text-red",
};

const CRM_LABEL: Record<CrmSyncStatus, string> = {
  done: "HubSpot done",
  queued: "HubSpot queued",
  dead: "HubSpot dead",
  missing: "HubSpot missing",
  "seed-implied": "HubSpot seed-implied",
  "not-applicable": "No CRM write",
};

const CRM_TINT: Record<CrmSyncStatus, string> = {
  done: "bg-green-soft text-green",
  queued: "bg-blue-soft text-blue",
  dead: "bg-red-soft text-red",
  missing: "bg-red-soft text-red",
  "seed-implied": "bg-amber-soft text-amber",
  "not-applicable": "bg-fill text-label",
};

function Badge({ label, tint }: { label: string; tint: string }) {
  return (
    <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${tint}`}>
      {label}
    </span>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mt-6">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">{kicker}</p>
      <h2 className="mt-0.5 font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortId(value: string | null) {
  if (!value) return "none";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
}

function dateLabel(value: string | null) {
  if (!value) return "not set";
  // GT is in Austin — render in Central Time (CST/CDT), not the server's UTC.
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(value));
}

function RowTimeline({ row }: { row: PaymentWatchRow }) {
  const steps = [
    {
      label: "Event ledger",
      value: row.eventStatus,
      detail: `${row.processedLedgerRows} processed row`,
      tint: STATUS_TINT[row.eventStatus] ?? "bg-blue-soft text-blue",
    },
    {
      label: "Payment row",
      value: row.paymentStatus,
      detail: `${shortId(row.intentId)} · rank ${row.statusRank}`,
      tint: STATUS_TINT[row.paymentStatus] ?? "bg-fill text-label",
    },
    {
      label: "Enrollment",
      value: row.enrollmentPaid ? "paid" : row.enrollmentPaid === false ? "unpaid" : "none",
      detail: row.enrollmentStage ?? "no enrollment",
      tint: row.enrollmentPaid ? "bg-green-soft text-green" : "bg-fill text-label",
    },
    {
      label: "CRM handoff",
      value: CRM_LABEL[row.crmSyncStatus],
      detail: row.outboxDedupeKey ?? row.hubspotDealId ?? "no deal",
      tint: CRM_TINT[row.crmSyncStatus],
    },
    {
      label: "Isolation",
      value: row.contaminationStatus,
      detail: row.visibleProgramKeys.join(", "),
      tint: row.contaminationStatus === "isolated" ? "bg-green-soft text-green" : "bg-red-soft text-red",
    },
  ];

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
      {steps.map((step) => (
        <div key={step.label} className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
          <div className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
            {step.label}
          </div>
          <div className="mt-1.5">
            <Badge label={step.value} tint={step.tint} />
          </div>
          <p className="mono mt-1.5 truncate text-[11px] text-slate" title={step.detail}>
            {step.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function PaymentPropagationDevPage() {
  const summary = await readPaymentPropagationSummary();
  const selected = summary.selected;
  const recentRows = summary.rows; // show all, newest-recorded first (sorted in propagation.ts)

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Payments
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Payment propagation watcher
      </h1>
      <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
        Stripe event ledger, payment status, enrollment handoff, idempotent replay, and
        program isolation in one admin surface. The page reads live DB rows when available
        and falls back to deterministic seed facts when credentials are absent.
      </p>

      <DevTabs />

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Source", summary.sourceLabel],
          ["Payment rows", summary.rows.length.toLocaleString()],
          ["Replay no-op", summary.idempotency.replayNoOpVisible ? "Visible" : "Not in source"],
          ["Contamination", summary.contamination.noContamination ? "None" : "Flagged"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      {summary.liveLimitations.length > 0 ? (
        <div className="mt-3 rounded-card border border-hairline bg-surface p-3 text-[11px] leading-snug text-muted">
          <b className="text-ink">Live limitation:</b>{" "}
          {summary.liveLimitations.join(" ")}
        </div>
      ) : null}

      {selected ? (
        <section>
          <SectionTitle kicker="Highlighted event" title="Replay-safe propagation path" />
          <div className="mt-3 rounded-card border border-hairline bg-surface p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="mono text-[12px] font-semibold text-slate">{selected.eventId}</code>
                  <Badge
                    label={selected.paymentStatus}
                    tint={STATUS_TINT[selected.paymentStatus] ?? "bg-fill text-label"}
                  />
                  <Badge
                    label={`${selected.deliveries} deliveries`}
                    tint={selected.idempotentReplayVisible ? "bg-green-soft text-green" : "bg-fill text-label"}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-muted">
                  {selected.programName} · {money(selected.amount)} · {dateLabel(selected.occurredAt)}
                </p>
              </div>
              <div className="text-right">
                <div className="mono text-[10px] uppercase tracking-[0.08em] text-label">Payment intent</div>
                <code className="mono mt-0.5 block text-[11px] text-blue">{selected.intentId}</code>
              </div>
            </div>
            <RowTimeline row={selected} />
          </div>
        </section>
      ) : (
        <div className="mt-4 rounded-card border border-hairline bg-surface p-3 text-[12px] text-muted">
          No payment rows are visible in the current source.
        </div>
      )}

      <SectionTitle kicker={`${summary.programs.length} scopes`} title="Program isolation" />
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {summary.programs.map((program) => (
          <div key={program.programId} className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[12px] font-semibold text-ink">{program.programName}</h3>
              <code className="mono text-[10px] text-blue">{program.programKey}</code>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              {[
                ["Rows", program.paymentCount],
                ["Events", program.processedEventCount],
                ["Won", program.succeededCount],
                ["Refunds", program.refundedCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[6px] bg-canvas px-1.5 py-1.5">
                  <div className="num text-[14px] font-bold text-ink">{value}</div>
                  <div className="mono text-[9px] uppercase tracking-[0.06em] text-label">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Cash-visible amount: <b className="text-ink">{money(program.amount)}</b>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-card border border-hairline bg-surface p-3 text-[11px] leading-snug text-muted">
        <b className={summary.contamination.noContamination ? "text-green" : "text-red"}>
          {summary.contamination.noContamination ? "No contamination detected." : "Contamination flagged."}
        </b>{" "}
        {summary.contamination.familiesInMultiplePrograms.toLocaleString()} families have enrollments in
        multiple programs; payment intents still resolve to a single program scope. Enrollment mismatches:{" "}
        <span className="num">{summary.contamination.crossProgramEnrollmentMismatches.length}</span>; intent
        collisions: <span className="num">{summary.contamination.crossProgramIntentContamination.length}</span>.
      </div>

      <SectionTitle kicker={`${recentRows.length} payments · newest recorded first`} title="Event/payment ledger" />
      <div className="mt-3 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-side">
              {["Event", "Program", "Payment", "Event status", "Replay", "CRM", "Isolation"].map((h) => (
                <th key={h} className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentRows.map((row) => (
              <tr key={row.paymentId} className="border-b border-hairline last:border-0 align-top">
                <td className="px-2.5 py-1">
                  <code className="mono block text-[11px] text-slate">{shortId(row.eventId)}</code>
                  <span className="mono text-[10px] text-label">{dateLabel(row.createdAt ?? row.occurredAt)}</span>
                </td>
                <td className="px-2.5 py-1 text-[11px] font-medium text-ink">{row.programName}</td>
                <td className="px-2.5 py-1">
                  <Badge label={row.paymentStatus} tint={STATUS_TINT[row.paymentStatus] ?? "bg-fill text-label"} />
                  <code className="mono mt-0.5 block text-[10px] text-label">{shortId(row.intentId)}</code>
                </td>
                <td className="px-2.5 py-1">
                  <Badge label={row.eventStatus} tint={STATUS_TINT[row.eventStatus] ?? "bg-blue-soft text-blue"} />
                </td>
                <td className="px-2.5 py-1 text-[11px] text-muted">
                  <span className="num text-ink">{row.deliveries}</span> deliveries ·{" "}
                  <span className="num text-ink">{row.processedLedgerRows}</span> ledger ·{" "}
                  <span className="num text-ink">{row.paymentRowsForIntent}</span> payment
                </td>
                <td className="px-2.5 py-1">
                  <Badge label={CRM_LABEL[row.crmSyncStatus]} tint={CRM_TINT[row.crmSyncStatus]} />
                </td>
                <td className="px-2.5 py-1">
                  <Badge
                    label={row.contaminationStatus}
                    tint={row.contaminationStatus === "isolated" ? "bg-green-soft text-green" : "bg-red-soft text-red"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle kicker="Demo path" title="How to show E1" />
      <div className="mt-3 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
        {summary.demoPath.map((step, index) => (
          <div key={step} className="flex gap-2.5 border-b border-hairline px-3 py-1.5 last:border-0">
            <span className="mono num mt-0.5 text-[11px] font-semibold text-gold">{index + 1}</span>
            <p className="text-[11px] leading-snug text-muted">{step}</p>
          </div>
        ))}
      </div>

      <footer className="mt-6 border-t border-hairline pt-3 text-[11px] text-label">
        Handler: <span className="mono">lib/payments.ts</span> · Surface summary:{" "}
        <span className="mono">lib/payments/propagation.ts</span> · Live proof:{" "}
        <span className="mono">tests/payments.test.ts</span> ·{" "}
        <Link href="/dev/tests" className="text-blue hover:underline">test theater</Link>
      </footer>
    </div>
  );
}
