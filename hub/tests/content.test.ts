// Module 3 — Content & Thought Leadership. Pure proofs for the sheet mirror,
// channel separation, content-to-conversion attribution, non-blocking brand voice,
// cross-link idempotency, sync conflict handling, and rendered sub-views.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { contentToConversion, channelConversionShare, xConversionRatio } from "@/lib/content/attribution";
import { defaultAuditor, canPublishWithSuggestions } from "@/lib/content/brand-voice";
import { ingestObjectionBrief, ingestTestimonial } from "@/lib/content/cross-links";
import { channelPerformance } from "@/lib/content/metrics";
import { buildPieces, calendarConflicts, canAdvance, kanban } from "@/lib/content/pieces";
import { reconcileField, seedSyncStates } from "@/lib/content/sync";

const ds = generate({ seed: 424242, families: 1200 });

describe("Content · sheet mirror and production pipeline", () => {
  it("builds one content piece per sheet row plus explicit cross-link stubs", () => {
    const pieces = buildPieces(ds);
    expect(pieces.filter((p) => p.source === "sheet")).toHaveLength(ds.content_sheet.length);
    expect(pieces.some((p) => p.source === "grassroots_stub" && p.consentStatus === "required")).toBe(true);
    expect(pieces.some((p) => p.source === "camp_xref" && p.readOnly)).toBe(true);
    expect(kanban(pieces).reduce((sum, col) => sum + col.pieces.length, 0)).toBe(pieces.length);
  });

  it("blocks camp rows and unconsented testimonial stubs from advancing", () => {
    const pieces = buildPieces(ds);
    const camp = pieces.find((p) => p.source === "camp_xref")!;
    const testimonial = pieces.find((p) => p.source === "grassroots_stub")!;
    expect(canAdvance(camp).ok).toBe(false);
    expect(canAdvance(testimonial).ok).toBe(false);
    expect(canAdvance({ ...testimonial, consentStatus: "ok" }).ok).toBe(true);
  });

  it("flags same-day/channel calendar conflicts", () => {
    const pieces = buildPieces(ds);
    const base = pieces.find((p) => p.status === "scheduled" || p.status === "published")!;
    const duplicate = { ...base, id: `${base.id}-dupe`, title: "Duplicate slot" };
    expect(calendarConflicts([...pieces, duplicate]).some((c) => c.day === base.publishDate && c.channel === base.channel)).toBe(true);
  });
});

describe("Content · attribution and channel separation", () => {
  it("joins content UTM to app_form conversions and keeps missing UTM explicit", () => {
    const pieces = buildPieces(ds);
    const perPiece = contentToConversion(pieces, ds);
    expect(perPiece).toHaveLength(pieces.length);
    expect(perPiece.some((p) => p.utmCampaign === "(not set)")).toBe(true);
    expect(perPiece.every((p) => p.conversions >= 0)).toBe(true);
  });

  it("computes channel shares and the X ratio from seed data, not a constant", () => {
    const pieces = buildPieces(ds);
    const shares = channelConversionShare(pieces, ds);
    const x = xConversionRatio(pieces, ds);
    expect(shares.some((s) => s.channel === "x")).toBe(true);
    expect(x.total).toBe(shares.reduce((sum, s) => sum + s.conversions, 0));
    expect(x.ratio).toBeGreaterThanOrEqual(0);
    expect(x.ratio).toBeLessThanOrEqual(1);
  });

  it("keeps Facebook, Instagram, and X as separate performance rows", () => {
    const channels = channelPerformance(ds).map((row) => row.channel);
    expect(channels).toContain("facebook");
    expect(channels).toContain("instagram");
    expect(channels).toContain("x");
    expect(channels).not.toContain("social" as never);
  });
});

describe("Content · brand voice, cross-links, and sync conflicts", () => {
  it("brand voice suggestions never block publish", () => {
    const suggestions = defaultAuditor.audit("piece-demo", "Very unique world-class synergy.");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(canPublishWithSuggestions(suggestions)).toBe(true);
  });

  it("Grassroots testimonial and VoC objection ingests are idempotent", () => {
    let processed = new Set<string>();
    let pieces = buildPieces(ds);
    const firstTestimonial = ingestTestimonial(pieces, processed, "test-1", { title: "Parent proof" });
    expect(firstTestimonial.created).toBe(true);
    pieces = firstTestimonial.pieces;
    processed = firstTestimonial.processed;
    expect(ingestTestimonial(pieces, processed, "test-1", { title: "Parent proof again" }).created).toBe(false);

    const firstBrief = ingestObjectionBrief(pieces, processed, "obj-1", "cost");
    expect(firstBrief.created).toBe(true);
    expect(ingestObjectionBrief(firstBrief.pieces, firstBrief.processed, "obj-1", "cost").created).toBe(false);
  });

  it("both-sides sheet/app edits become conflicts with both values retained", () => {
    const state = reconcileField({
      pieceId: "piece-1",
      sheetRowId: "sheet-1",
      field: "status",
      appValue: "published",
      sheetValue: "scheduled",
      appUpdatedAt: "2026-06-13T00:00:00.000Z",
      sheetUpdatedAt: "2026-06-13T00:00:00.000Z",
      lastSyncedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(state.conflict).toBe(true);
    expect(state.appValue).toBe("published");
    expect(state.sheetValue).toBe("scheduled");
    expect(seedSyncStates().some((s) => s.conflict)).toBe(true);
  });
});

vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: ContentPage } = await import("@/app/m/content/page");

async function render(tab?: string, role?: string): Promise<string> {
  const node = await ContentPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Content · rendered sub-views", () => {
  it("overview and pipeline render the source-of-truth framing", async () => {
    const overview = await render("overview", "operator");
    expect(overview).toContain("Content &amp; Thought Leadership");
    expect(overview).toContain("Top performers");
    expect(overview).toContain("app_form");
    expect(overview).toContain('href="/m/submissions"');
    expect(overview).toContain("My submissions");
    expect(overview).not.toContain('href="/m/decisions"');
    const pipeline = await render("pipeline", "operator");
    expect(pipeline).toContain("Production pipeline");
    expect(pipeline).toContain("consent required");
  });

  it("calendar, performance, and library tabs render their proof surfaces", async () => {
    expect(await render("calendar", "operator")).toContain("Content calendar");
    expect(await render("performance", "operator")).toContain("Channel performance");
    const library = await render("library", "operator");
    expect(library).toContain("brand-voice auditor");
    expect(library).toContain("never blocks");
  });
});
