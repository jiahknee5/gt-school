import Link from "next/link";
import {
  formatRows,
  listProviderDatasets,
  type DatasetSummary,
} from "@/lib/opendata/catalog";

export const dynamic = "force-dynamic";

function DatasetRow({ d }: { d: DatasetSummary }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-ink">{d.name}</h3>
        <span className="mono shrink-0 text-[11px] text-muted">{formatRows(d.rows)} rows</span>
      </div>
      {d.description ? (
        <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-muted">{d.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {d.geographicScope ? (
          <span className="mono rounded-[6px] border border-hairline px-2 py-0.5 text-[10px] text-label">
            {d.geographicScope}
          </span>
        ) : null}
        {d.temporalGranularity ? (
          <span className="mono rounded-[6px] border border-hairline px-2 py-0.5 text-[10px] text-label">
            {d.temporalGranularity}
          </span>
        ) : null}
        {d.categories.slice(0, 4).map((c) => (
          <span
            key={c}
            className="mono rounded-[6px] bg-blue-soft px-2 py-0.5 text-[10px] text-blue"
          >
            {c}
          </span>
        ))}
      </div>
      {d.path ? (
        <code className="mono mt-3 block truncate rounded-[6px] bg-canvas px-2 py-1 text-[11px] text-slate">
          GET {d.path}
        </code>
      ) : null}
    </div>
  );
}

export default async function ProviderDatasets({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  let datasets: DatasetSummary[] = [];
  let error: string | null = null;
  let source: string | null = null;

  try {
    const res = await listProviderDatasets(provider, { limit: 100 });
    datasets = res.data;
    source = res.source;
  } catch (err) {
    error = err instanceof Error ? err.message : "Open Data is unreachable right now.";
  }

  const totalRows = datasets.reduce((sum, d) => sum + d.rows, 0);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 flex h-[57px] items-center gap-3.5 border-b border-hairline bg-topbar px-[18px]">
        <Link
          href="/opendata"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-ink"
        >
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-gold text-[13px] font-bold text-white shadow-sm">
            GT
          </span>
          Open Data Explorer
        </Link>
        <span className="h-6 w-px bg-hairline" />
        <span className="mono text-[13px] font-medium text-slate">{provider}</span>
      </header>

      <main className="mx-auto max-w-[1180px] px-7 py-12">
        <Link href="/opendata" className="mono text-[12px] text-muted hover:text-ink">
          ← All providers
        </Link>
        <h1 className="mt-3 font-serif text-[30px] font-bold tracking-[-0.02em] text-ink">
          {provider}
        </h1>
        {!error ? (
          <p className="mono mt-2 text-[12px] text-muted">
            {datasets.length} datasets · {formatRows(totalRows)} rows
            {source ? ` · ${source}` : ""}
          </p>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-card border border-hairline bg-surface p-5 text-[13px] text-muted">
            <b className="text-ink">Couldn&apos;t load {provider}.</b> {error}
          </div>
        ) : datasets.length === 0 ? (
          <div className="mt-8 rounded-card border border-hairline bg-surface p-5 text-[13px] text-muted">
            No ready datasets found for <span className="mono">{provider}</span>.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {datasets.map((d) => (
              <DatasetRow key={d.path || d.slug} d={d} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
