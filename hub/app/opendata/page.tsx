import Link from "next/link";
import {
  curateProviders,
  formatRows,
  getPlatformStats,
  listProviders,
  type ProviderSummary,
  type ProviderTier,
} from "@/lib/opendata/catalog";
import type { OpenDataSource } from "@/lib/opendata/client";

export const dynamic = "force-dynamic";

const TIER_META: Record<
  Exclude<ProviderTier, "other">,
  { label: string; blurb: string; tint: string }
> = {
  "texas-school": {
    label: "Texas school data",
    blurb: "Home market — PEIMS finance, STAAR, A–F accountability, the TEFA voucher.",
    tint: "bg-gold text-white",
  },
  education: {
    label: "Education (other)",
    blurb: "National + other-state education sources for comparison and expansion markets.",
    tint: "bg-blue-soft text-blue",
  },
};

function SourceBadge({ source }: { source: OpenDataSource }) {
  const label = source === "live" ? "live" : source === "cache" ? "cached" : "stand-in";
  return (
    <span className="mono rounded-[6px] border border-hairline bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-label">
      {label}
    </span>
  );
}

function ProviderCard({ p }: { p: ProviderSummary }) {
  return (
    <Link
      href={`/opendata/${p.slug}`}
      className="group flex flex-col rounded-card border border-hairline bg-surface p-4 shadow-sm transition-colors hover:border-border"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold text-ink">{p.name}</span>
        <span className="mono text-[11px] text-muted">{p.slug}</span>
      </div>
      {p.description ? (
        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-muted">{p.description}</p>
      ) : null}
      <div className="mono mt-3 flex gap-3 text-[11px] text-label">
        <span>
          <b className="text-ink">{p.datasetCount}</b> datasets
        </span>
        <span>
          <b className="text-ink">{formatRows(p.totalRows)}</b> rows
        </span>
      </div>
    </Link>
  );
}

export default async function OpenDataExplorer() {
  let stats: Awaited<ReturnType<typeof getPlatformStats>> | null = null;
  let providersRes: Awaited<ReturnType<typeof listProviders>> | null = null;
  let error: string | null = null;

  try {
    [stats, providersRes] = await Promise.all([getPlatformStats(), listProviders()]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Open Data is unreachable right now.";
  }

  const tiers = providersRes ? curateProviders(providersRes.data) : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 flex h-[57px] items-center gap-3.5 border-b border-hairline bg-topbar px-[18px]">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-ink"
        >
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-gold text-[13px] font-bold text-white shadow-sm">
            GT
          </span>
          Marketing Hub
        </Link>
        <span className="h-6 w-px bg-hairline" />
        <span className="text-[13px] font-medium text-slate">Open Data Explorer</span>
        {providersRes ? (
          <span className="ml-auto">
            <SourceBadge source={providersRes.source} />
          </span>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1180px] px-7 py-12">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          External · tryopendata.ai
        </p>
        <h1 className="mt-2 font-serif text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Every dataset the Hub can pull
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-muted">
          A read-only map of public data available for enrichment. We don&apos;t mirror it —
          modules query at decision time and cache. Texas school sources are surfaced first.
        </p>

        {stats ? (
          <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {[
              ["Providers", String(stats.data.totalProviders)],
              ["Datasets", String(stats.data.totalDatasets)],
              ["Rows", formatRows(stats.data.totalRows)],
              ["New this week", `+${stats.data.addedThisWeek}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-card border border-hairline bg-surface p-4">
                <div className="mono text-[11px] uppercase tracking-[0.1em] text-label">{label}</div>
                <div className="mt-1 font-serif text-[26px] font-bold text-ink">{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-card border border-hairline bg-surface p-5 text-[13px] text-muted">
            <b className="text-ink">Open Data is unreachable.</b> {error} The decision-enrichment
            flow still works offline via the stood-in fixture; this catalog needs the live API.
          </div>
        ) : null}

        {tiers
          ? (["texas-school", "education"] as const).map((tier) => {
              const list = tiers[tier];
              if (list.length === 0) return null;
              const meta = TIER_META[tier];
              return (
                <section key={tier} className="mt-10">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`mono rounded-[6px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${meta.tint}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[12px] text-muted">{meta.blurb}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((p) => (
                      <ProviderCard key={p.slug} p={p} />
                    ))}
                  </div>
                </section>
              );
            })
          : null}

        {tiers && tiers.other.length > 0 ? (
          <section className="mt-10">
            <div className="flex items-center gap-2.5">
              <span className="mono rounded-[6px] border border-hairline bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
                All other providers
              </span>
              <span className="text-[12px] text-muted">{tiers.other.length} sources</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.other.map((p) => (
                <ProviderCard key={p.slug} p={p} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
