import Link from "next/link";
import { guidesByCategory, GUIDES } from "@/lib/help/guides";
import { TourButton } from "@/app/_components/TourButton";

export const metadata = {
  title: "Help & user guides - GT Marketing Hub",
};

const CATEGORY_TINT: Record<string, string> = {
  "Run the cadence": "bg-fill text-slate",
  "Grow the funnel": "bg-fill text-slate",
  "Close the loop": "bg-fill text-slate",
  "Govern & trust": "bg-fill text-slate",
  Personalize: "bg-fill text-slate",
};

function cleanCopy(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, " to ")
    .replace(/\u2194/g, " and ")
    .replace(/\u00b7/g, "/");
}

export default function HelpIndex() {
  const groups = guidesByCategory();

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-10">
      <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / User guides
      </p>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
        How to get things done in the Hub
      </h1>
      <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-muted">
        Step-by-step guides for the common jobs that span more than one module: run the
        Monday meeting, grow the funnel, close the feedback loop, and keep the data
        trustworthy. Each guide shows what you click, where, and what happens.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Link
          href="/help/roadmap"
          className="group flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-4 shadow-sm transition-colors hover:border-gold"
        >
          <div>
            <p className="text-[14px] font-semibold text-ink group-hover:text-gold">Build roadmap -&gt;</p>
            <p className="mt-0.5 text-[13px] text-muted">Which modules we build, in what order, and why.</p>
          </div>
          <span className="mono shrink-0 rounded-[6px] bg-fill px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate">
            5 tiers
          </span>
        </Link>

        <Link
          href="/help/priority-workflows"
          className="group flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-4 shadow-sm transition-colors hover:border-gold"
        >
          <div>
            <p className="text-[14px] font-semibold text-ink group-hover:text-gold">Priority workflows -&gt;</p>
            <p className="mt-0.5 text-[13px] text-muted">Side-by-side grader workflows with business and tech value.</p>
          </div>
          <span className="mono shrink-0 rounded-[6px] bg-fill px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate">
            5 flows
          </span>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[
          ["Guides", `${GUIDES.length}`],
          ["Categories", `${groups.length}`],
          ["From the spec", `${GUIDES.filter((g) => g.fromSpec).length}`],
          ["Modules covered", "13"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-4">
            <div className="mono text-[11px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-1 font-serif text-[24px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.category} className="mt-12">
          <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
            {group.category}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {group.guides.map((g) => {
              const tint = CATEGORY_TINT[g.category] ?? "bg-fill text-slate";

              return (
                <article
                  key={g.slug}
                  className="flex flex-col rounded-card border border-hairline bg-surface shadow-sm transition-colors hover:border-gold"
                >
                  <Link href={`/help/${g.slug}`} className="group flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-gold">
                        {g.title}
                      </h2>
                      <span
                        className={`mono shrink-0 rounded-[6px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${tint}`}
                      >
                        {g.steps.length} steps
                      </span>
                    </div>
                    <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{cleanCopy(g.objective)}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {g.modules.slice(0, 5).map((m) => (
                        <span key={m} className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">
                          {m}
                        </span>
                      ))}
                      {g.modules.length > 5 && (
                        <span className="mono px-1 py-0.5 text-[10px] text-label">+{g.modules.length - 5}</span>
                      )}
                    </div>
                    {g.fromSpec && (
                      <p className="mono mt-3 text-[10px] uppercase tracking-[0.08em] text-gold">From the spec</p>
                    )}
                  </Link>
                  <div className="border-t border-hairline px-5 py-2.5">
                    <TourButton slug={g.slug} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <footer className="mt-12 border-t border-hairline pt-5 text-[12px] text-label">
        Guides catalog: <span className="mono">lib/help/guides.ts</span> / Cross-module
        workflows: <span className="mono">docs/use-cases/README.md</span> / GT Challenge:{" "}
        <span className="mono">docs/06-gt-challenge/WORKFLOW.md</span> / Priority workflows:{" "}
        <span className="mono">docs/use-cases/PRIORITY-WORKFLOWS.md</span>
      </footer>
    </div>
  );
}
