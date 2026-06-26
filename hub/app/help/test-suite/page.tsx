import Link from "next/link";
import { TEST_GROUPS, catalogCounts, groupCounts, type TestKind } from "@/lib/help/test-catalog";

export const metadata = {
  title: "Test suite - GT Marketing Hub",
};

const KIND_TINT: Record<TestKind, string> = {
  pure: "bg-green-soft text-green",
  live: "bg-amber-soft text-amber",
};

const KIND_LABEL: Record<TestKind, string> = {
  pure: "pure",
  live: "live",
};

export default function TestSuitePage() {
  const counts = catalogCounts();

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / Test suite
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Every test in the suite
      </h1>
      <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
        The full, organized listing of every automated test, derived straight from the
        files in <span className="mono text-slate">hub/tests/</span>. The suite proves the
        product&rsquo;s contracts: deterministic seed data, identity reconciliation,
        payment &amp; sync correctness, role-based access, and that each module&rsquo;s
        rendered surface behaves. Tests are grouped by the same domain taxonomy as{" "}
        <span className="mono text-slate">lib/dev/suites.ts</span>, with each row marked{" "}
        <b className="text-ink">pure</b> (no services, runs in CI) or{" "}
        <b className="text-ink">live</b> (needs DB / HubSpot / Stripe, skips gracefully).
      </p>

      <div className="mt-3 rounded-card border border-hairline bg-surface p-3">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
          How to run
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          The CI gate is the union of every pure file:{" "}
          <code className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">npm run test:ci</code>{" "}
          ({counts.pure} tests, always green). Run a single domain with its grouped script,
          or the service-gated suites with{" "}
          <code className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">npm run test:live</code>.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "npm run test:ci",
            "npm run test:data",
            "npm run test:backend",
            "npm run test:scenarios",
            "npm run test:frontend",
            "npm run test:live",
          ].map((cmd) => (
            <code
              key={cmd}
              className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate"
            >
              {cmd}
            </code>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Total tests", `${counts.total}`],
          ["CI gate (pure)", `${counts.pure}`],
          ["Live (gated)", `${counts.live}`],
          ["Test files", `${counts.files}`],
          ["Groups", `${counts.groups}`],
          ["Pending / todo", "0"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-label">
        <span className="flex items-center gap-1.5">
          <span className={`mono rounded-[4px] px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] ${KIND_TINT.pure}`}>pure</span>
          no services - part of the CI gate
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`mono rounded-[4px] px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] ${KIND_TINT.live}`}>live</span>
          needs DB / HubSpot / Stripe - skips gracefully
        </span>
      </div>

      {TEST_GROUPS.map((group) => {
        const gc = groupCounts(group);
        return (
          <section key={group.id} className="mt-7">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
                {group.label}
              </p>
              <span className="mono text-[10px] text-label">
                {gc.total} tests
                {gc.live > 0 && <span className="text-amber"> / {gc.live} live</span>}
              </span>
              <code className="mono ml-auto rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate">
                {group.script}
              </code>
            </div>
            <p className="mt-1 max-w-[760px] text-[11px] leading-snug text-muted">{group.domain}</p>

            <div className="mt-2 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline bg-fill">
                    <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-label">Test</th>
                    <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-label">Proves</th>
                    <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-label">File</th>
                    <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-label">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, i) => (
                    <tr key={`${row.file}-${i}`} className="border-b border-hairline last:border-0 align-top">
                      <td className="px-2.5 py-1 text-[11px] leading-snug text-ink">{row.test}</td>
                      <td className="px-2.5 py-1 text-[11px] leading-snug text-slate">{row.area}</td>
                      <td className="px-2.5 py-1">
                        <code className="mono text-[10px] text-label">{row.file}</code>
                      </td>
                      <td className="px-2.5 py-1">
                        <span className={`mono rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${KIND_TINT[row.kind]}`}>
                          {KIND_LABEL[row.kind]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <footer className="mt-7 border-t border-hairline pt-4 text-[11px] text-label">
        Catalog data: <span className="mono">lib/help/test-catalog.ts</span> / Suite layout:{" "}
        <span className="mono">lib/dev/suites.ts</span> / Use-case map:{" "}
        <span className="mono">lib/dev/usecases.ts</span> / Suite docs:{" "}
        <span className="mono">tests/README.md</span> /{" "}
        <Link href="/help" className="text-blue hover:underline">all guides -&gt;</Link>
      </footer>
    </div>
  );
}
