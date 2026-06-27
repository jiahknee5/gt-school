import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoTip, Explain } from "@/app/_components/InfoTip";
import { PageObjective } from "@/app/_components/PageObjective";
import {
  EXPLANATIONS,
  PAGE_OBJECTIVES,
  explain,
  pageObjective,
  type ExplanationKey,
} from "@/lib/help/explanations";
import { MODULES } from "@/lib/modules";

const keys = Object.keys(EXPLANATIONS) as ExplanationKey[];

describe("InfoTip primitive", () => {
  it("renders an accessible, focusable trigger wired to the tip via aria-describedby", () => {
    const html = renderToStaticMarkup(
      createElement(InfoTip, { label: "Active ambassadors", text: "A plain-language description." }),
    );
    // Real button (keyboard-focusable), labelled for screen readers.
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="What is Active ambassadors?"');
    // Tip is a role=tooltip element wired to the trigger and ALWAYS present in the DOM.
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("A plain-language description.");
    expect(html).toMatch(/aria-describedby="[^"]+"/);
  });

  it("Explain renders the centralized text for a key (single source of truth)", () => {
    const html = renderToStaticMarkup(createElement(Explain, { k: "shared.data-confidence" }));
    expect(html).toContain(explain("shared.data-confidence").text);
    expect(html).toContain("What is Data confidence?");
  });

  it("PageObjective leads with the module's business objective and why it matters", () => {
    const html = renderToStaticMarkup(createElement(PageObjective, { slug: "budget" }));
    expect(html).toContain("Objective");
    expect(html).toContain(pageObjective("budget")!.objective);
    expect(html).toContain("Why it matters");
  });

  it("PageObjective renders nothing for an unknown slug", () => {
    expect(renderToStaticMarkup(createElement(PageObjective, { slug: "nope" }))).toBe("");
  });
});

describe("explanations.ts content quality (zero-redundancy + coverage)", () => {
  it("every explanation has a non-trivial label and description", () => {
    for (const k of keys) {
      const e = EXPLANATIONS[k];
      expect(e.label.length, k).toBeGreaterThan(2);
      expect(e.text.length, k).toBeGreaterThan(30);
    }
  });

  it("no two explanations repeat the same description (no redundancy)", () => {
    const texts = keys.map((k) => EXPLANATIONS[k].text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("every module slug has a business objective + why-it-matters", () => {
    for (const m of MODULES) {
      const o = PAGE_OBJECTIVES[m.slug];
      expect(o, m.slug).toBeDefined();
      expect(o.objective.length, m.slug).toBeGreaterThan(20);
      expect(o.matters.length, m.slug).toBeGreaterThan(20);
    }
  });

  it("no two module objectives are identical (no restated objective)", () => {
    const objs = Object.values(PAGE_OBJECTIVES).map((o) => o.objective);
    expect(new Set(objs).size).toBe(objs.length);
  });
});
