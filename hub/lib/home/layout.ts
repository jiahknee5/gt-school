import {
  WIDGET_LIBRARY,
  widgetsForUser,
  type DemoUser,
  type Role,
  type WidgetDef,
} from "@/lib/phase2";

export const HOME_LAYOUT_SCHEMA_VERSION = 1;

export type HomeWidgetSize = WidgetDef["size"];

export type HomeLayoutItem = {
  widget_key: string;
  size: HomeWidgetSize;
  order: number;
};

export type HomeLayout = {
  user_id: string;
  role: Role;
  widgets: HomeLayoutItem[];
  version: number;
  updated_at: string | null;
  persisted: boolean;
  warnings: string[];
};

type NormalizeOptions = {
  allowEmpty?: boolean;
};

type RawLayoutItem = Partial<HomeLayoutItem> & {
  id?: unknown;
  key?: unknown;
  widgetKey?: unknown;
};

const SIZE_ALIASES: Record<string, HomeWidgetSize> = {
  s: "small",
  small: "small",
  m: "medium",
  medium: "medium",
  l: "large",
  large: "large",
};

const registry = new Map(WIDGET_LIBRARY.map((widget) => [widget.id, widget]));

function normalizeSize(value: unknown, fallback: HomeWidgetSize): HomeWidgetSize {
  const key = String(value ?? "").trim().toLowerCase();
  return SIZE_ALIASES[key] ?? fallback;
}

function widgetFallbackSize(widgetKey: string): HomeWidgetSize {
  return registry.get(widgetKey)?.size ?? "medium";
}

export function starterHomeLayout(user: DemoUser): HomeLayoutItem[] {
  return widgetsForUser(user).map((widget, index) => ({
    widget_key: widget.id,
    size: widget.size,
    order: index,
  }));
}

export function normalizeHomeLayoutItems(
  input: unknown,
  fallback: HomeLayoutItem[],
  options: NormalizeOptions = {},
): { widgets: HomeLayoutItem[]; warnings: string[] } {
  if (!Array.isArray(input)) {
    return { widgets: fallback, warnings: ["layout_not_array"] };
  }

  const warnings: string[] = [];
  const byKey = new Map<string, HomeLayoutItem>();
  input.forEach((raw, index) => {
    if (raw == null || typeof raw !== "object") {
      warnings.push(`invalid_item_${index}`);
      return;
    }
    const item = raw as RawLayoutItem;
    const widgetKey = String(
      item.widget_key ?? item.widgetKey ?? item.key ?? item.id ?? "",
    ).trim();
    if (!widgetKey) {
      warnings.push(`missing_widget_key_${index}`);
      return;
    }
    if (byKey.has(widgetKey)) {
      warnings.push(`duplicate_${widgetKey}`);
      return;
    }
    if (!registry.has(widgetKey)) {
      warnings.push(`unknown_${widgetKey}`);
    }
    byKey.set(widgetKey, {
      widget_key: widgetKey,
      size: normalizeSize(item.size, widgetFallbackSize(widgetKey)),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
    });
  });

  const widgets = [...byKey.values()]
    .sort((a, b) => a.order - b.order || a.widget_key.localeCompare(b.widget_key))
    .map((item, index) => ({ ...item, order: index }));

  return {
    widgets: widgets.length || options.allowEmpty ? widgets : fallback,
    warnings,
  };
}

export function layoutForUser(
  user: DemoUser,
  row?: {
    user_id: string;
    role: Role;
    widgets: unknown;
    version: number;
    updated_at: string | Date | null;
  } | null,
): HomeLayout {
  const fallback = starterHomeLayout(user);
  const normalized = row
    ? normalizeHomeLayoutItems(row.widgets, fallback, { allowEmpty: true })
    : { widgets: fallback, warnings: [] };

  return {
    user_id: user.id,
    role: user.role,
    widgets: normalized.widgets,
    version: row?.version ?? HOME_LAYOUT_SCHEMA_VERSION,
    updated_at: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    persisted: Boolean(row),
    warnings: normalized.warnings,
  };
}

export function addWidget(
  current: HomeLayoutItem[],
  widgetKey: string,
  size?: HomeWidgetSize,
): HomeLayoutItem[] {
  if (current.some((item) => item.widget_key === widgetKey)) return current;
  return normalizeHomeLayoutItems(
    [
      ...current,
      { widget_key: widgetKey, size: size ?? widgetFallbackSize(widgetKey), order: current.length },
    ],
    current,
  ).widgets;
}

export function removeWidget(current: HomeLayoutItem[], widgetKey: string): HomeLayoutItem[] {
  return normalizeHomeLayoutItems(
    current.filter((item) => item.widget_key !== widgetKey),
    [],
  ).widgets;
}

export function reorderWidget(
  current: HomeLayoutItem[],
  widgetKey: string,
  toIndex: number,
): HomeLayoutItem[] {
  const sorted = normalizeHomeLayoutItems(current, []).widgets;
  const fromIndex = sorted.findIndex((item) => item.widget_key === widgetKey);
  if (fromIndex < 0) return sorted;
  const [item] = sorted.splice(fromIndex, 1);
  sorted.splice(Math.max(0, Math.min(toIndex, sorted.length)), 0, item);
  return sorted.map((entry, index) => ({ ...entry, order: index }));
}

export function resolveHomeWidgets(layout: HomeLayoutItem[]): {
  item: HomeLayoutItem;
  widget: WidgetDef | null;
}[] {
  return layout.map((item) => ({
    item,
    widget: registry.get(item.widget_key) ?? null,
  }));
}
