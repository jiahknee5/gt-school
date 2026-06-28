import type { ReactNode } from "react";
import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import { TEST_GROUPS, catalogCounts, groupCounts, type TestKind } from "@/lib/help/test-catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test suite — GT Marketing Hub",
};

const KIND_TINT: Record<TestKind, string> = {
  pure: "bg-green-soft text-green",
  live: "bg-amber-soft text-amber",
};

const KIND_LABEL: Record<TestKind, string> = {
  pure: "pure",
  live: "live",
};

/** Collapsed-by-default section — same pattern as the Test theater tab. Native
 *  <details>, so it stays a server component with no client JS. forceOpen pins it open. */
function Collapsible({
  kicker,
  title,
  meta,
  forceOpen = false,
  children,
}: {
  kicker: string;
  title: string;
  meta?: ReactNode;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={forceOpen} className="group mt-3 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-hover [&::-webkit-details-marker]:hidden">
        <span className="mono shrink-0 text-[10px] text-label transition-transform group-open:rotate-90">&#9656;</span>
        <span className="min-w-0">
          <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">{kicker}</span>
          <span className="block font-serif text-[14px] font-bold tracking-[-0.01em] text-ink">{title}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">{meta}</span>
      </summary>
      <div className="border-t border-hairline">{children}</div>
    </details>
  );
}

export default function TestSuitePage() {
  const counts = catalogCounts();

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Test suite
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Every test in the suite
      </h1>
      <p className="mt-1.5 max-w-[820px] text-[12px] leading-snug text-muted">
        The full, organized listing of every automated test, derived from the files in{" "}
        <span className="mono text-slate">hub/tests/</span>. The suite proves the product&rsquo;s
        contracts: deterministic seed data, identity reconciliation, payment &amp; sync correctness,
        role-based access, the honesty/provenance layer, and that each module&rsquo;s rendered surface
        behaves. Each row is <b className="text-ink">pure</b> (no services, in the CI gate) or{" "}
        <b className="text-ink">live</b> (needs DB / HubSpot / Stripe, skips gracefully).
      </p>

      <DevTabs />

      {/* ============ SUMMARY (top of page) ============ */}
      <section className="mt-4 rounded-card border border-hairline bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="num font-serif text-[28px] font-bold leading-none text-ink">{counts.total}</span>
            <span className="mono text-[11px] text-label">catalog tests</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="text-green"><b className="num">{counts.pure}</b> pure (CI gate)</span>
            <span className="text-amber"><b className="num">{counts.live}</b> live (gated)</span>
            <span className="text-muted"><b className="num">{counts.files}</b> files</span>
            <span className="text-muted"><b className="num">{counts.groups}</b> categories</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Catalog rows", `${counts.total}`],
            ["Pure (CI)", `${counts.pure}`],
            ["Live (gated)", `${counts.live}`],
            ["Test files", `${counts.files}`],
            ["Categories", `${counts.groups}`],
            ["Pending", "0"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-hairline bg-canvas p-2.5">
              <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
              <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-label">
          <span className="flex items-center gap-1.5">
            <span className={`mono rounded-[4px] px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] ${KIND_TINT.pure}`}>pure</span>
            no services — part of the CI gate
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`mono rounded-[4px] px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] ${KIND_TINT.live}`}>live</span>
            needs DB / HubSpot / Stripe — skips gracefully
          </span>
        </div>
      </section>

      {/* ============ DETAIL (collapsed by default) ============ */}
      <p className="mono mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-label">
        Detail — expand a category
      </p>

      {TEST_GROUPS.map((group) => {
        const gc = groupCounts(group);
        return (
          <Collapsible
            key={group.id}
            kicker={group.label}
            title={group.domain}
            meta={
              <>
                <span className="mono text-[10px] text-label">
                  {gc.total} tests{gc.live > 0 && <span className="text-amber"> · {gc.live} live</span>}
                </span>
                <code className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">{group.script}</code>
              </>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline bg-fill">
                    {["Test", "Proves", "File", "Type"].map((h) => (
                      <th key={h} className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-label">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, i) => (
                    <tr key={`${row.file}-${i}`} className="border-b border-hairline last:border-0 align-top">
                      <td className="px-2.5 py-1 text-[11px] leading-snug text-ink">{row.test}</td>
                      <td className="px-2.5 py-1 text-[11px] leading-snug text-slate">{row.area}</td>
                      <td className="px-2.5 py-1"><code className="mono text-[10px] text-label">{row.file}</code></td>
                      <td className="px-2.5 py-1">
                        <span className={`mono rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${KIND_TINT[row.kind]}`}>{KIND_LABEL[row.kind]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible>
        );
      })}

      {/* how to run */}
      <Collapsible kicker="Reproducible" title="How to run">
        <p className="px-3 pt-2.5 text-[11px] leading-snug text-muted">
          The CI gate is the union of every pure file:{" "}
          <code className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">npm run test:ci</code>.
          Run a single domain with its grouped script, or the service-gated suites with{" "}
          <code className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">npm run test:live</code>.
          The full local run is ~599 tests across 61 files in ~12s.
        </p>
        <div className="flex flex-wrap gap-1.5 p-3 pt-2">
          {["npm run test:ci", "npm run test:data", "npm run test:backend", "npm run test:scenarios", "npm run test:frontend", "npm run test:live"].map((cmd) => (
            <code key={cmd} className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">{cmd}</code>
          ))}
        </div>
      </Collapsible>

      <footer className="mt-6 border-t border-hairline pt-4 text-[11px] text-label">
        Catalog: <span className="mono">lib/help/test-catalog.ts</span> · Suite layout:{" "}
        <span className="mono">lib/dev/suites.ts</span> · Use-case map:{" "}
        <span className="mono">lib/dev/usecases.ts</span> ·{" "}
        <Link href="/dev/tests" className="text-blue hover:underline">Test theater →</Link>
      </footer>
    </div>
  );
}
