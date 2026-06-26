import {
  addWidget,
  normalizeHomeLayoutItems,
  removeWidget,
  reorderWidget,
  type HomeLayoutItem,
  type HomeWidgetSize,
} from "@/lib/home/layout";
import { WIDGET_LIBRARY, type Role, type WidgetDef } from "@/lib/phase2";

export type HomeWidgetPickerGroup = {
  category: string;
  widgets: WidgetDef[];
};

export type HomeWidgetPickerPayload = {
  widgets: HomeLayoutItem[];
};

const STARTER_WIDGET_IDS = WIDGET_LIBRARY.filter((widget) => widget.starter).map(
  (widget) => widget.id,
);
const widgetSizes = new Map(WIDGET_LIBRARY.map((widget) => [widget.id, widget.size]));

export function starterHomeWidgetPickerItems(role: Role | null | undefined): HomeLayoutItem[] {
  const ids = new Set(STARTER_WIDGET_IDS);
  if (role === "leader") ids.add("decision-preview");
  if (role === "operator") ids.add("content-pipeline");

  return WIDGET_LIBRARY.filter((widget) => ids.has(widget.id)).map((widget, index) => ({
    widget_key: widget.id,
    size: widget.size,
    order: index,
  }));
}

export function normalizeHomeWidgetPickerItems(
  input: unknown,
  role: Role | null | undefined,
): HomeLayoutItem[] {
  return normalizeHomeLayoutItems(input, starterHomeWidgetPickerItems(role), {
    allowEmpty: true,
  }).widgets;
}

export function groupHomeWidgetPickerResults(
  query: string,
  library: WidgetDef[] = WIDGET_LIBRARY,
): HomeWidgetPickerGroup[] {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, WidgetDef[]>();

  for (const widget of library) {
    const haystack = `${widget.label} ${widget.category} ${widget.source} ${widget.size}`.toLowerCase();
    if (q && !haystack.includes(q)) continue;
    groups.set(widget.category, [...(groups.get(widget.category) ?? []), widget]);
  }

  return [...groups.entries()].map(([category, widgets]) => ({ category, widgets }));
}

export function setHomeWidgetSelected(
  current: HomeLayoutItem[],
  widgetKey: string,
  selected: boolean,
): HomeLayoutItem[] {
  if (!selected) return removeWidget(current, widgetKey);
  return addWidget(current, widgetKey, widgetSizes.get(widgetKey) as HomeWidgetSize | undefined);
}

export function moveHomeWidget(
  current: HomeLayoutItem[],
  widgetKey: string,
  delta: -1 | 1,
): HomeLayoutItem[] {
  const sorted = normalizeHomeLayoutItems(current, [], { allowEmpty: true }).widgets;
  const index = sorted.findIndex((item) => item.widget_key === widgetKey);
  if (index < 0) return sorted;
  return reorderWidget(sorted, widgetKey, index + delta);
}

export function buildHomeWidgetPickerDonePayload(
  current: HomeLayoutItem[],
): HomeWidgetPickerPayload {
  return {
    widgets: normalizeHomeLayoutItems(current, [], { allowEmpty: true }).widgets,
  };
}
