import { describe, expect, it } from "vitest";
import {
  buildHomeWidgetPickerDonePayload,
  groupHomeWidgetPickerResults,
  moveHomeWidget,
  setHomeWidgetSelected,
  starterHomeWidgetPickerItems,
} from "@/app/_components/homeWidgetPickerState";

describe("Home widget picker state", () => {
  it("searches the widget library by label, category, and source", () => {
    const results = groupHomeWidgetPickerResults("objection");

    expect(results).toEqual([
      expect.objectContaining({
        category: "Voice of customer",
        widgets: [
          expect.objectContaining({
            id: "top-objections",
            label: "Top objections this week",
          }),
        ],
      }),
    ]);
  });

  it("adds and removes widgets from the selected layout without duplicating keys", () => {
    const started = starterHomeWidgetPickerItems("operator");
    const withoutPipeline = setHomeWidgetSelected(started, "content-pipeline", false);
    const withObjections = setHomeWidgetSelected(withoutPipeline, "top-objections", true);
    const duplicateObjections = setHomeWidgetSelected(withObjections, "top-objections", true);

    expect(started.map((item) => item.widget_key)).toContain("content-pipeline");
    expect(withoutPipeline.map((item) => item.widget_key)).not.toContain("content-pipeline");
    expect(withObjections.at(-1)).toMatchObject({
      widget_key: "top-objections",
      size: "medium",
      order: withoutPipeline.length,
    });
    expect(duplicateObjections).toHaveLength(withObjections.length);
    expect(duplicateObjections.filter((item) => item.widget_key === "top-objections")).toHaveLength(1);
  });

  it("reorders selected widgets and clamps boundary moves", () => {
    const started = starterHomeWidgetPickerItems("leader");
    const movedUp = moveHomeWidget(started, "decision-preview", -1);
    const movedToTop = moveHomeWidget(movedUp, "decision-preview", -1);
    const alreadyTop = moveHomeWidget(movedToTop, movedToTop[0].widget_key, -1);

    expect(started.at(-1)?.widget_key).toBe("decision-preview");
    expect(movedUp.at(-2)?.widget_key).toBe("decision-preview");
    expect(movedToTop.at(-3)?.widget_key).toBe("decision-preview");
    expect(alreadyTop.map((item) => item.order)).toEqual(alreadyTop.map((_, index) => index));
  });

  it("builds the Done payload in the Home layout API shape", () => {
    const started = starterHomeWidgetPickerItems("operator");
    const edited = moveHomeWidget(
      setHomeWidgetSelected(
        setHomeWidgetSelected(started, "content-pipeline", false),
        "top-objections",
        true,
      ),
      "top-objections",
      -1,
    );

    const payload = buildHomeWidgetPickerDonePayload(edited);

    expect(Object.keys(payload)).toEqual(["widgets"]);
    expect(payload.widgets.map((item) => item.order)).toEqual(
      payload.widgets.map((_, index) => index),
    );
    expect(payload.widgets.at(-2)).toMatchObject({
      widget_key: "top-objections",
      size: "medium",
    });
    expect(JSON.stringify(payload)).not.toContain("user_id");
  });
});
