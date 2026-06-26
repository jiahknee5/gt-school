import Link from "next/link";
import { DevTabs } from "./_components/DevTabs";
import { readManifest } from "@/lib/dev/manifest";
import {
  COMMANDS,
  DATA_STORES,
  EDGE_CASES,
  RECONCILE_THREAD,
  SOURCES,
  UTM_THREAD,
} from "@/lib/dev/catalog";

export const dynamic = "force-dynamic";

const KIND_TINT: Record<string, string> = {
  real: "bg-green-soft text-green",
  standin: "bg-amber-soft text-amber",
  external: "bg-blue-soft text-blue",
};

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mt-6">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">{kicker}</p>
      <h2 className="mt-0.5 font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
    </div>
  );
}

export default async function DevOverview() {
  const manifest = await readManifest();
  const realRows = manifest
    ? manifest.real.reduce((s, k) => s + (manifest.counts[k] ?? 0), 0)
    : null;
  const standRows = manifest
    ? manifest.standIn.reduce((s, k) => s + (manifest.counts[k] ?? 0), 0)
    : null;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Data
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        How the Hub&apos;s data is modeled
      </h1>
      <p className="mt-1.5 max-w-[680px] text-[12px] leading-snug text-muted">
        The data model, sources, and a field-level dictionary — plus where every row
        lives and how it&apos;s generated. Real systems vs. honestly-labeled stand-ins,
        threaded by two join keys: <span className="mono text-slate">utm_campaign</span> for
        analytics, <span className="mono text-slate">match_key</span> for transactional.
      </p>

      <DevTabs />

      {manifest ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Seed", `#${manifest.seed}`],
            ["Real rows", realRows!.toLocaleString()],
            ["Stood-in rows", standRows!.toLocaleString()],
            ["Edge cases", `${manifest.edgeCases.length}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-hairline bg-surface p-2.5">
              <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
              <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-card border border-hairline bg-surface p-3 text-[11px] text-muted">
          <b className="text-ink">No fixtures generated yet.</b> Run{" "}
          <code className="mono rounded bg-fill px-1.5 py-0.5 text-slate">npm run seed:fixtures</code>{" "}
          to populate <span className="mono">seed-data/</span> and see live counts.
        </div>
      )}

      {/* ---- where the data lives ---- */}
      <SectionTitle kicker="3 stores" title="Where the data lives" />
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DATA_STORES.map((s) => (
          <div key={s.id} className="flex flex-col rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-semibold text-ink">{s.name}</h3>
              <span
                className={`mono rounded-[6px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                  s.runtimeReadByApp ? "bg-green-soft text-green" : "bg-fill text-label"
                }`}
              >
                {s.runtimeReadByApp ? "app reads" : "offline"}
              </span>
            </div>
            <code className="mono mt-1.5 block truncate rounded-[6px] bg-canvas px-2 py-1 text-[11px] text-slate">
              {s.path}
            </code>
            <p className="mt-1.5 flex-1 text-[11px] leading-snug text-muted">{s.what}</p>
            <code className="mono mt-1.5 block rounded-[6px] bg-fill px-2 py-1 text-[11px] text-ink">
              {s.populate}
            </code>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        The Hub app does not read <span className="mono">seed-data/</span> at runtime — those
        fixtures are for walkthroughs, tests, and loading Postgres. Meta/GA4/X/summer are JSON
        only today (no backbone table, not wired to a module yet).
      </p>

      {/* ---- data sources ---- */}
      <SectionTitle kicker="11 systems" title="Data sources" />
      <div className="mt-2.5 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-side">
              {["System", "Kind", "Table(s)", "Join key", "Grain", "Note"].map((h) => (
                <th key={h} className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.system} className="border-b border-hairline last:border-0 align-top">
                <td className="px-2.5 py-1 text-[12px] font-semibold text-ink">{s.system}</td>
                <td className="px-2.5 py-1">
                  <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${KIND_TINT[s.kind]}`}>
                    {s.kind === "standin" ? "stand-in" : s.kind}
                  </span>
                </td>
                <td className="mono px-2.5 py-1 text-[11px] text-slate">{s.tables}</td>
                <td className="mono px-2.5 py-1 text-[11px] text-blue">{s.joinKey}</td>
                <td className="px-2.5 py-1 text-[11px] text-muted">{s.grain}</td>
                <td className="px-2.5 py-1 text-[11px] text-muted">{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- architecture / threads ---- */}
      <SectionTitle kicker="Two join keys" title="How the sources connect" />
      <div className="mt-2.5 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
          <h3 className="text-[12px] font-semibold text-ink">
            Attribution thread <span className="mono text-[11px] font-normal text-blue">utm_campaign</span>
          </h3>
          <ol className="mt-1.5 space-y-0.5">
            {UTM_THREAD.map((step) => (
              <li key={step} className="mono text-[11px] leading-snug text-slate">{step}</li>
            ))}
          </ol>
        </div>
        <div className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
          <h3 className="text-[12px] font-semibold text-ink">
            Reconciliation thread <span className="mono text-[11px] font-normal text-blue">match_key</span>
          </h3>
          <ol className="mt-1.5 space-y-0.5">
            {RECONCILE_THREAD.map((step) => (
              <li key={step} className="mono text-[11px] leading-snug text-slate">{step}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* ---- edge cases ---- */}
      <SectionTitle kicker={`${EDGE_CASES.length} on purpose`} title="Deliberate edge cases" />
      <p className="mt-1.5 max-w-[680px] text-[11px] leading-snug text-muted">
        Built to stress isolation, idempotency, and dual-source reconciliation. Each is asserted
        by <span className="mono">lib/seed/invariants.ts</span> and listed in the manifest.
      </p>
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {EDGE_CASES.map((e) => {
          const present = manifest?.edgeCases.includes(e.key) ?? false;
          return (
            <div key={e.key} className="flex gap-2 rounded-card border border-hairline bg-surface p-2.5">
              <span
                className={`mono mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                  present ? "bg-green-soft text-green" : "bg-fill text-label"
                }`}
                title={present ? "present in current fixtures" : "not in current fixtures"}
              >
                {present ? "\u2713" : "\u00b7"}
              </span>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-ink">{e.label}</div>
                <div className="text-[11px] leading-snug text-muted">{e.proves}</div>
                <code className="mono mt-0.5 block text-[10px] text-label">{e.key}</code>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- commands ---- */}
      <SectionTitle kicker="Reproducible" title="Generate & reset" />
      <div className="mt-2.5 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
        {COMMANDS.map((c) => (
          <div key={c.cmd} className="flex flex-col gap-0.5 border-b border-hairline px-3 py-1.5 last:border-0 sm:flex-row sm:items-center sm:gap-4">
            <code className="mono shrink-0 text-[11px] text-ink sm:w-[340px]">{c.cmd}</code>
            <span className="text-[11px] text-muted">{c.what}</span>
          </div>
        ))}
      </div>

      <footer className="mt-6 border-t border-hairline pt-3 text-[11px] text-label">
        Catalog: <span className="mono">lib/dev/catalog.ts</span> · Backbone:{" "}
        <span className="mono">supabase/migrations/0001_backbone.sql</span> · Generator:{" "}
        <span className="mono">lib/seed/</span> ·{" "}
        <Link href="/dev/data-model" className="text-blue hover:underline">data model →</Link>
      </footer>
    </div>
  );
}
