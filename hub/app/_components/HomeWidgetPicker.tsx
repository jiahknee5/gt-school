"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { HomeLayoutItem } from "@/lib/home/layout";
import { WIDGET_LIBRARY, type Role } from "@/lib/phase2";
import {
  buildHomeWidgetPickerDonePayload,
  groupHomeWidgetPickerResults,
  moveHomeWidget,
  normalizeHomeWidgetPickerItems,
  setHomeWidgetSelected,
  starterHomeWidgetPickerItems,
} from "./homeWidgetPickerState";

export type HomeWidgetPickerViewer = {
  id: string;
  role: Role;
};

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

type ApiLayoutBody = {
  layout?: {
    widgets?: unknown;
  };
  error?: string;
};

function selectedSet(items: HomeLayoutItem[]) {
  return new Set(items.map((item) => item.widget_key));
}

function statusText({
  viewer,
  saveState,
  error,
  selectedCount,
}: {
  viewer: HomeWidgetPickerViewer | null;
  saveState: SaveState;
  error: string | null;
  selectedCount: number;
}) {
  if (!viewer) return "Sign in to save layout changes.";
  if (saveState === "loading") return "Loading saved layout...";
  if (saveState === "saving") return "Saving layout...";
  if (saveState === "saved") return "Layout saved.";
  if (error) return error;
  return `${selectedCount} selected`;
}

export function HomeWidgetPicker({
  viewer,
}: {
  viewer: HomeWidgetPickerViewer | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HomeLayoutItem[]>(() =>
    starterHomeWidgetPickerItems(viewer?.role),
  );
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => selectedSet(items), [items]);
  const selectedWidgets = useMemo(
    () =>
      items.map((item) => ({
        item,
        widget: WIDGET_LIBRARY.find((candidate) => candidate.id === item.widget_key) ?? null,
      })),
    [items],
  );
  const groups = useMemo(() => groupHomeWidgetPickerResults(query), [query]);
  const selectedCount = items.length;

  useEffect(() => {
    if (!open || !viewer || loadedForUser === viewer.id) return;
    const activeViewer = viewer;
    const controller = new AbortController();

    async function loadLayout() {
      setSaveState("loading");
      setError(null);
      try {
        const response = await fetch("/api/home/layout", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as ApiLayoutBody;
        if (!response.ok) throw new Error(body.error ?? "Could not load saved layout.");
        setItems(normalizeHomeWidgetPickerItems(body.layout?.widgets, activeViewer.role));
        setLoadedForUser(activeViewer.id);
        setSaveState("idle");
      } catch (err) {
        if (controller.signal.aborted) return;
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Could not load saved layout.");
      }
    }

    void loadLayout();
    return () => controller.abort();
  }, [loadedForUser, open, viewer]);

  async function saveLayout() {
    if (!viewer) {
      setError("Sign in to save layout changes.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setError(null);
    try {
      const response = await fetch("/api/home/layout", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildHomeWidgetPickerDonePayload(items)),
      });
      const body = (await response.json().catch(() => ({}))) as ApiLayoutBody;
      if (!response.ok) throw new Error(body.error ?? "Could not save layout.");

      setItems(normalizeHomeWidgetPickerItems(body.layout?.widgets, viewer.role));
      setLoadedForUser(viewer.id);
      setSaveState("saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Could not save layout.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="home-widget-picker"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center rounded-card bg-gold px-2.5 text-[12px] font-semibold text-white transition-transform active:translate-y-px sm:px-3"
      >
        <span className="sm:hidden">+ Widget</span>
        <span className="hidden sm:inline">+ Add widget</span>
      </button>
      {open && (
        <div
          id="home-widget-picker"
          className="absolute right-0 top-10 z-50 w-[92vw] max-w-[440px] rounded-card border border-border bg-surface p-3 shadow-lg sm:w-[440px]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Home widgets</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {statusText({ viewer, saveState, error, selectedCount })}
              </p>
            </div>
            <button
              type="button"
              onClick={saveLayout}
              disabled={saveState === "saving" || saveState === "loading"}
              className="h-8 shrink-0 rounded-card border border-border bg-canvas px-2.5 text-[12px] font-semibold text-ink transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              Done
            </button>
          </div>

          {selectedWidgets.length > 0 && (
            <div className="mt-3 rounded-card border border-hairline bg-canvas p-2">
              <p className="mono mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                Selected
              </p>
              <div className="max-h-[150px] space-y-1 overflow-y-auto pr-1">
                {selectedWidgets.map(({ item, widget }, index) => (
                  <div
                    key={item.widget_key}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[6px] border border-hairline bg-surface px-2 py-1.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-ink">
                        {widget?.label ?? item.widget_key}
                      </span>
                      <span className="mono block truncate text-[10px] text-label">
                        {widget?.source ?? "Saved layout"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${widget?.label ?? item.widget_key} up`}
                        disabled={index === 0}
                        onClick={() =>
                          setItems((current) => moveHomeWidget(current, item.widget_key, -1))
                        }
                        className="h-7 rounded-[6px] border border-border px-2 text-[11px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${widget?.label ?? item.widget_key} down`}
                        disabled={index === selectedWidgets.length - 1}
                        onClick={() =>
                          setItems((current) => moveHomeWidget(current, item.widget_key, 1))
                        }
                        className="h-7 rounded-[6px] border border-border px-2 text-[11px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${widget?.label ?? item.widget_key}`}
                        onClick={() =>
                          setItems((current) =>
                            setHomeWidgetSelected(current, item.widget_key, false),
                          )
                        }
                        className="h-7 rounded-[6px] border border-border px-2 text-[11px] font-semibold text-red"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label htmlFor="home-widget-search" className="sr-only">
            Search widgets
          </label>
          <input
            id="home-widget-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search widgets"
            className="mt-3 h-9 w-full rounded-card border border-border bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-label focus:border-gold"
          />

          <div className="mt-3 max-h-[48dvh] space-y-3 overflow-y-auto pr-1">
            {groups.length === 0 ? (
              <p className="rounded-card border border-hairline bg-canvas p-3 text-[12px] text-muted">
                No widgets match that search.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.category}>
                  <p className="mono mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                    {group.category}
                  </p>
                  <div className="space-y-1">
                    {group.widgets.map((widget) => {
                      const checked = selected.has(widget.id);
                      return (
                        <label
                          key={widget.id}
                          className="flex cursor-pointer items-start gap-2 rounded-card border border-hairline bg-canvas p-2.5 hover:border-border hover:bg-hover"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setItems((current) =>
                                setHomeWidgetSelected(current, widget.id, event.target.checked),
                              )
                            }
                            className="mt-0.5 h-3.5 w-3.5 accent-gold"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-ink">
                              {widget.label}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-1.5">
                              <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">
                                {widget.source}
                              </span>
                              <span className="mono rounded-[5px] border border-hairline px-1.5 py-0.5 text-[9px] text-label">
                                {widget.size}
                              </span>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
