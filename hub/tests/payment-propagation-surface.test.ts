import { describe, expect, it } from "vitest";
import {
  buildPaymentPropagationSummary,
  buildSeedPaymentPropagationSummary,
  type PaymentPropagationInput,
} from "@/lib/payments/propagation";
import { generate } from "@/lib/seed/generate";
import type { SeedDataset } from "@/lib/seed/types";

function inputFromSeed(ds: SeedDataset): PaymentPropagationInput {
  return {
    source: "seed-fixture",
    generatedAt: ds.manifest.generatedAt,
    programs: ds.programs,
    payments: ds.payments,
    enrollments: ds.enrollments,
    processedEvents: ds.processed_events,
    syncEventLog: ds.sync_event_log,
    syncOutbox: ds.sync_outbox,
  };
}

describe("Payment propagation watcher surface contract", () => {
  it("exposes the E1 watcher signals from deterministic seed facts", () => {
    const summary = buildSeedPaymentPropagationSummary(generate({ seed: 5, families: 800 }));

    expect(summary.source).toBe("seed-fixture");
    expect(summary.signals.processedEventStatusVisible).toBe(true);
    expect(summary.signals.paymentStatusVisible).toBe(true);
    expect(summary.signals.programIsolationVisible).toBe(true);
    expect(summary.signals.idempotentReplayVisible).toBe(true);
    expect(summary.signals.contaminationSignalVisible).toBe(true);
    expect(summary.demoPath.join(" ")).toContain("/dev/payments");
    expect(summary.selected?.eventStatus).not.toBe("missing-ledger");
    expect(summary.selected?.paymentStatus).toMatch(/succeeded|refunded|failed|requires_payment/);
  });

  it("makes replay idempotency visible as one ledger row and one payment row", () => {
    const summary = buildSeedPaymentPropagationSummary(generate({ seed: 5, families: 800 }));

    expect(summary.idempotency.eventId).toBeTruthy();
    expect(summary.idempotency.intentId).toBeTruthy();
    expect(summary.idempotency.deliveries).toBeGreaterThan(1);
    expect(summary.idempotency.duplicateDeliveries).toBeGreaterThan(0);
    expect(summary.idempotency.processedLedgerRows).toBe(1);
    expect(summary.idempotency.paymentRowsForIntent).toBe(1);
    expect(summary.idempotency.replayNoOpVisible).toBe(true);
  });

  it("keeps no-contamination evidence visible even when families span programs", () => {
    const summary = buildSeedPaymentPropagationSummary(generate({ seed: 5, families: 800 }));

    expect(summary.contamination.noContamination).toBe(true);
    expect(summary.contamination.crossProgramEnrollmentMismatches).toEqual([]);
    expect(summary.contamination.crossProgramIntentContamination).toEqual([]);
    expect(summary.contamination.familiesInMultiplePrograms).toBeGreaterThan(0);
    expect(summary.rows.every((row) => row.visibleProgramKeys.length === 1)).toBe(true);
    expect(summary.rows.every((row) => row.contaminationStatus === "isolated")).toBe(true);
  });

  it("flags contamination instead of hiding a dirty cross-program payment", () => {
    const ds = generate({ seed: 5, families: 800 });
    const sourcePayment = ds.payments.find((p) => p.enrollment_id && p.program_key === "summer_camp");
    const otherProgram = ds.programs.find((p) => p.key !== sourcePayment?.program_key);

    expect(sourcePayment).toBeDefined();
    expect(otherProgram).toBeDefined();

    const dirtySummary = buildPaymentPropagationSummary({
      ...inputFromSeed(ds),
      payments: [
        ...ds.payments,
        {
          ...sourcePayment!,
          id: "dirty-cross-program-payment",
          program_id: otherProgram!.id,
          program_key: otherProgram!.key,
          stripe_event_id: "evt_dirty_cross_program",
        },
      ],
    });

    expect(dirtySummary.contamination.noContamination).toBe(false);
    expect(dirtySummary.contamination.crossProgramEnrollmentMismatches).toHaveLength(1);
    expect(dirtySummary.contamination.crossProgramIntentContamination).toEqual([
      {
        intentId: sourcePayment!.stripe_payment_intent_id,
        programKeys: expect.arrayContaining([sourcePayment!.program_key, otherProgram!.key]),
      },
    ]);
    expect(dirtySummary.signals.contaminationSignalVisible).toBe(true);
    expect(dirtySummary.signals.programIsolationVisible).toBe(false);
    expect(dirtySummary.rows.some((row) => row.contaminationStatus === "contaminated")).toBe(true);
  });
});
