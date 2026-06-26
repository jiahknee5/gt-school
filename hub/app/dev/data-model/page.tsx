import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import { readManifest } from "@/lib/dev/manifest";
import {
  ZONE_META,
  ZONES,
  tablesByZone,
  type TableDef,
} from "@/lib/dev/catalog";

export const dynamic = "force-dynamic";

function TableCard({ t, count }: { t: TableDef; count: number | null }) {
  // Show the load-bearing fields (keys/authority/idempotency) on the model card;
  // the full field list lives in the dictionary.
  const keyFields = t.fields.filter((f) => f.tags && f.tags.length > 0).slice(0, 7);
  return (
    <div className="flex flex-col rounded-card border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/dev/dictionary#${t.name}`}
          className="mono text-[13px] font-semibold text-ink hover:text-blue"
        >
          {t.name}
        </Link>
        {count !== null ? (
          <span className="num mono text-[11px] text-label">{count.toLocaleString()}</span>
        ) : null}
      </div>
      <p className="mt-1 text-[12px] font-medium text-slate">{t.title}</p>
      <p className="mono mt-1 text-[10px] uppercase tracking-[0.06em] text-label">
        SoT · {t.sourceOfTruth}
      </p>
      <p className="mt-2 text-[12px] leading-snug text-muted">{t.why}</p>

      {keyFields.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1 border-t border-hairline pt-2.5">
          {keyFields.map((f) => (
            <div key={f.name} className="flex items-center gap-2">
              <code className="mono text-[11px] text-slate">{f.name}</code>
              {f.tags?.map((tag) => (
                <span
                  key={tag}
                  className={`mono rounded-[4px] px-1 py-px text-[8px] font-semibold uppercase tracking-[0.04em] ${
                    tag === "key"
                      ? "bg-blue-soft text-blue"
                      : tag === "idem"
                        ? "bg-red-soft text-red"
                        : tag === "rls"
                          ? "bg-green-soft text-green"
                          : tag === "app"
                            ? "bg-green-soft text-green"
                            : tag === "hs"
                              ? "bg-violet-soft text-violet"
                              : tag === "fixture"
                                ? "bg-amber-soft text-amber"
                                : "bg-fill text-label"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {t.relationships && t.relationships.length > 0 ? (
        <div className="mt-3 flex flex-col gap-0.5 border-t border-hairline pt-2.5">
          {t.relationships.map((r) => (
            <code key={r} className="mono text-[10px] leading-relaxed text-muted">↳ {r}</code>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function DataModel() {
  const manifest = await readManifest();
  const countOf = (name: string): number | null => manifest?.counts[name] ?? null;

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-10">
      <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Data
      </p>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Data model
      </h1>
      <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-muted">
        One sentence holds it together: a <b className="text-ink">family</b> (one HubSpot contact)
        has <b className="text-ink">children</b>, joins <b className="text-ink">programs</b>, turns
        into <b className="text-ink">enrollments</b> (deals), and those get paid by{" "}
        <b className="text-ink">payments</b>. Everything else keeps that picture honest across
        HubSpot, Stripe, and the app.
      </p>

      <DevTabs />

      {ZONES.map((zone) => {
        const meta = ZONE_META[zone];
        const tables = tablesByZone(zone);
        return (
          <section key={zone} className="mt-10">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`mono rounded-[6px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${meta.tint}`}
              >
                {meta.label}
              </span>
              <span className="text-[12px] text-muted">{meta.blurb}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((t) => (
                <TableCard key={t.name} t={t} count={countOf(t.name)} />
              ))}
            </div>
          </section>
        );
      })}

      <footer className="mt-12 border-t border-hairline pt-5 text-[12px] text-label">
        Card chips show the load-bearing fields (keys, authority, idempotency, RLS scope). Full
        column list per table →{" "}
        <Link href="/dev/dictionary" className="text-blue hover:underline">data dictionary</Link>.
      </footer>
    </div>
  );
}
