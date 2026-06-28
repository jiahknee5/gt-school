import Link from "next/link";
import type { StatusSnapshotMeta } from "@/lib/status/board";
import { ctDate } from "@/lib/format/datetime";

function weekHref(week: string, currentWeek: string): string {
  return week === currentWeek ? "/m/status" : `/m/status?week=${week}`;
}

export function StatusWeekBar({
  weeks,
  selectedWeek,
  currentWeek,
  meta,
}: {
  weeks: string[];
  selectedWeek: string;
  currentWeek: string;
  meta?: StatusSnapshotMeta;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm" data-tour="status-week-selector">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
            Reporting week
          </span>
          {weeks.map((w) => (
            <Link
              key={w}
              href={weekHref(w, currentWeek)}
              aria-current={w === selectedWeek ? "page" : undefined}
              className={`mono rounded-card border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                w === selectedWeek
                  ? "border-gold bg-amber-soft text-ink"
                  : "border-hairline bg-surface text-muted hover:text-ink"
              }`}
            >
              {w.slice(5)}
            </Link>
          ))}
        </div>

        {meta && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                meta.isCurrent
                  ? "border-green/40 bg-green-soft/40 text-green"
                  : "border-amber/40 bg-amber-soft/50 text-amber"
              }`}
              title={meta.isCurrent ? "Current reporting week" : "Historical snapshot — what the verdict said that week"}
            >
              {meta.isCurrent ? "● Current week" : "◑ Historical snapshot"}
            </span>
            <span
              className="mono inline-flex items-center gap-1 rounded-full border border-border bg-canvas px-2 py-0.5 text-[9px] font-semibold text-slate"
              title={
                meta.source === "llm"
                  ? `LLM-written verdict (${meta.model}), ${meta.recalled ? "pre-loaded" : "generated on view"}.`
                  : `Rubric-templated verdict, ${meta.recalled ? "pre-loaded" : "generated on view for speed"}. The LLM-written verdict is produced by the daily refresh when a model key is configured.`
              }
            >
              {meta.source === "llm" ? "✦ LLM" : "▦ Deterministic"} ·{" "}
              {meta.recalled ? "pre-loaded" : "on view"} · {ctDate(meta.generatedAt)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
