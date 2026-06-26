import Link from "next/link";
import { ROADMAP, roadmapCounts, type BuildStatus } from "@/lib/help/roadmap";

export const metadata = {
  title: "Build roadmap - GT Marketing Hub",
};

const STATUS_TINT: Record<BuildStatus, string> = {
  foundation: "bg-fill text-slate",
  "build-deep": "bg-fill text-slate",
  build: "bg-fill text-slate",
  stub: "bg-fill text-slate",
};
const STATUS_LABEL: Record<BuildStatus, string> = {
  foundation: "foundation",
  "build-deep": "build deep",
  build: "build",
  stub: "stub last",
};

function cleanCopy(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, " to ")
    .replace(/\u2194/g, " and ")
    .replace(/\u00b7/g, "/");
}

export default function RoadmapPage() {
  const counts = roadmapCounts();

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / Build roadmap
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        What we build, in what order, and why
      </h1>
      <p className="mt-1.5 max-w-[720px] text-[12px] leading-snug text-muted">
        Dependency- and value-driven sequencing: foundation first (auth + roles), then the
        modules that <b className="text-ink">prove the whole system</b>: the four
        &ldquo;show us it works&rdquo; signals plus single-source-of-truth, reconciliation,
        and RBAC. Then depth, the funnel/loop modules, and the lighter manual surfaces.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Tiers", `${counts.tiers}`],
          ["Modules", `${counts.modules}`],
          ["Build deep", `${counts.deep}`],
          ["Demo signals", `${counts.signals}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      {ROADMAP.map((tier) => (
        <section key={tier.tier} className="mt-6">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            Tier {tier.tier}
          </p>
          <h2 className="mt-1 font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">
            {tier.label}
          </h2>
          <p className="mt-1 max-w-[760px] text-[11px] leading-snug text-muted">{cleanCopy(tier.rationale)}</p>

          <div className="mt-3 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
            {tier.items.map((item) => (
              <div key={item.order} className="border-b border-hairline px-3 py-2.5 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill text-[11px] font-bold text-slate">
                    {item.order}
                  </span>
                  <h3 className="text-[12px] font-semibold text-ink">
                    {item.n !== null && <span className="mono text-muted">M{item.n} / </span>}
                    {item.module}
                  </h3>
                  <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${STATUS_TINT[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  {item.slug && (
                    <code className="mono ml-auto text-[10px] text-label">docs/modules/{String(item.n).padStart(2, "0")}-{item.slug}/PLAN.md</code>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted">{cleanCopy(item.why)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-label">Depends on: <span className="text-slate">{cleanCopy(item.depends)}</span></span>
                  {item.signals.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-label">Lights:</span>
                      {item.signals.map((s) => (
                        <span key={s} className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[9px] text-slate">{cleanCopy(s)}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-6 border-t border-hairline pt-4 text-[11px] text-label">
        Roadmap data: <span className="mono">lib/help/roadmap.ts</span> / Per-module specs:{" "}
        <span className="mono">docs/modules/</span> / Build loop:{" "}
        <span className="mono">docs/05-build/MODULE-RUNBOOK.md</span> /{" "}
        <Link href="/help" className="text-blue hover:underline">all guides -&gt;</Link>
      </footer>
    </div>
  );
}
