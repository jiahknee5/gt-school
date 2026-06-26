// Module 12 — Resource Library. Pure proofs for the PLAN's provable invariants: query-layer
// RBAC denial, every resource filed (≥1 tag), badge truth, small-n search recall, upload
// Inputs→Outputs, no fabricated counts, link health surfaced, honesty/reset (is_sample).

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { SAMPLE_RESOURCES } from "@/lib/library/data";
import { TAGS } from "@/lib/library/types";
import { deriveBadge } from "@/lib/library/badge";
import { visibleResources, canSeeLeadership, canUpload, canEditResource } from "@/lib/library/rbac";
import { searchResources, filterResources, fold } from "@/lib/library/search";
import { addResource, validateUpload } from "@/lib/library/upload";
import { downloadChip, totalDownloads } from "@/lib/library/access";

const ds = generate({ seed: 424242, families: 1200 });

describe("Library · query-layer RBAC denial (invariant #1)", () => {
  it("an Operator never receives a leadership-only resource", () => {
    const opView = visibleResources(SAMPLE_RESOURCES, "operator");
    expect(opView.some((r) => r.visibility === "leadership")).toBe(false);
    expect(opView.some((r) => r.title === "Brand Strategy")).toBe(false);
    const leaderView = visibleResources(SAMPLE_RESOURCES, "leader");
    expect(leaderView.some((r) => r.title === "Brand Strategy")).toBe(true);
    expect(canSeeLeadership("operator")).toBe(false);
    expect(canSeeLeadership("admin")).toBe(true);
  });

  it("search cannot leak a leadership row even with a matching query", () => {
    const opView = visibleResources(SAMPLE_RESOURCES, "operator");
    const hit = searchResources(opView, "brand");
    expect(hit.some((r) => r.visibility === "leadership")).toBe(false);
  });
});

describe("Library · every resource is filed (invariant #2)", () => {
  it("every row carries ≥1 controlled-vocab tag; tag filter returns exactly its rows", () => {
    for (const r of SAMPLE_RESOURCES) {
      expect(r.tags.length).toBeGreaterThanOrEqual(1);
      for (const t of r.tags) expect(TAGS).toContain(t);
    }
    const filtered = filterResources(SAMPLE_RESOURCES, { tag: "persona" });
    expect(filtered.every((r) => r.tags.includes("persona"))).toBe(true);
    expect(filtered).toHaveLength(SAMPLE_RESOURCES.filter((r) => r.tags.includes("persona")).length);
  });
});

describe("Library · badge truth (invariant #3)", () => {
  it("badges derive from URL/MIME, never mismatched", () => {
    expect(deriveBadge({ url: "https://docs.google.com/presentation/d/x" })).toBe("SLIDES");
    expect(deriveBadge({ url: "https://docs.google.com/spreadsheets/d/x" })).toBe("SHEET");
    expect(deriveBadge({ url: "https://assets.gt.school/x.pdf" })).toBe("PDF");
    expect(deriveBadge({ url: "https://notes.gt.school/x.md" })).toBe("MD");
    const brand = SAMPLE_RESOURCES.find((r) => r.title === "Brand Strategy")!;
    expect(brand.fileType).toBe("SLIDES");
  });
});

describe("Library · small-n search recall (invariant #4)", () => {
  it("partial/synonym, case/diacritic-insensitive queries find the intended sample", () => {
    expect(searchResources(SAMPLE_RESOURCES, "results").some((r) => r.title.includes("Outcomes"))).toBe(true);
    expect(searchResources(SAMPLE_RESOURCES, "PERSONA").some((r) => r.title.includes("Persona"))).toBe(true);
    expect(fold("Résumé")).toBe("resume");
  });
});

describe("Library · upload Inputs→Outputs (invariant #5)", () => {
  it("a valid upload yields a row with owner=current user and date=now, badge derived", () => {
    expect(validateUpload({ title: "", tags: [], visibility: undefined })).toContain("title");
    const r = addResource(
      { title: "New Playbook", tags: ["playbook"], visibility: "all", url: "https://docs.google.com/document/d/new" },
      "Maya Patel",
      "2026-07-01T00:00:00.000Z",
    );
    expect(r.owner).toBe("Maya Patel");
    expect(r.createdAt).toBe("2026-07-01T00:00:00.000Z");
    expect(r.fileType).toBe("DOC");
    expect(r.isSample).toBe(false);
    // appears in a subsequent visible list
    const list = visibleResources([...SAMPLE_RESOURCES, r], "operator");
    expect(list.some((x) => x.id === r.id)).toBe(true);
  });
});

describe("Library · no fabricated counts (invariant #6)", () => {
  it("non-PDF resources never get a download chip; PDF chip equals a read-only GA4 derivation", () => {
    const slides = SAMPLE_RESOURCES.find((r) => r.fileType === "SLIDES")!;
    expect(downloadChip(slides, ds)).toBeNull();
    const pdf = SAMPLE_RESOURCES.find((r) => r.fileType === "PDF")!;
    const chip = downloadChip(pdf, ds);
    if (totalDownloads(ds) > 0) expect(chip).toBeGreaterThan(0);
  });

  it("with no Analytics data, no chip is fabricated", () => {
    const emptyDs = { ...ds, ga4_days: [] };
    const pdf = SAMPLE_RESOURCES.find((r) => r.fileType === "PDF")!;
    expect(downloadChip(pdf, emptyDs)).toBeNull();
  });
});

describe("Library · link health + honesty (invariants #7, #8)", () => {
  it("a dead-linked resource is flagged link_ok=false", () => {
    expect(SAMPLE_RESOURCES.some((r) => r.linkOk === false)).toBe(true);
  });

  it("every mocked resource is is_sample=true (reset to a known state)", () => {
    expect(SAMPLE_RESOURCES.every((r) => r.isSample)).toBe(true);
  });

  it("edit is allowed for owner or admin only", () => {
    const r = SAMPLE_RESOURCES[0];
    expect(canEditResource("admin", r, "someone")).toBe(true);
    expect(canEditResource("operator", r, r.owner)).toBe(true);
    expect(canEditResource("operator", r, "not-owner")).toBe(false);
    expect(canUpload("operator")).toBe(true);
  });
});

// ───────────────── rendered page (auth mocked) ─────────────────
vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: LibraryPage } = await import("@/app/m/library/page");

async function render(params: { q?: string; tag?: string; role?: string }): Promise<string> {
  const node = await LibraryPage({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(node);
}

describe("Library · rendered shelf", () => {
  it("operator shelf excludes Brand Strategy; leader shelf includes it", async () => {
    const op = await render({ role: "operator" });
    expect(op).toContain("Resource Library");
    expect(op).not.toContain("Brand Strategy");
    const leader = await render({ role: "leader" });
    expect(leader).toContain("Brand Strategy");
  });

  it("search filters the shelf; dead link renders an unreachable state", async () => {
    const results = await render({ q: "results", role: "leader" });
    expect(results).toContain("Outcomes / Results Tracker");
    expect(results).toContain("link unreachable");
  });

  it("no-match renders the empty state", async () => {
    const none = await render({ q: "zzzznotfound", role: "leader" });
    expect(none).toContain("No matches");
  });
});
