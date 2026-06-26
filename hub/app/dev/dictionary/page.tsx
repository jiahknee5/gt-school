import { DevTabs } from "../_components/DevTabs";
import { readManifest } from "@/lib/dev/manifest";
import {
  TAG_META,
  TABLES,
  ZONE_META,
  ZONES,
  tablesByZone,
  type FieldTag,
  type TableDef,
} from "@/lib/dev/catalog";

export const dynamic = "force-dynamic";

function TagChip({ tag }: { tag: FieldTag }) {
  const m = TAG_META[tag];
  return (
    <span className={`mono rounded-[4px] px-1 py-px text-[8px] font-semibold uppercase tracking-[0.04em] ${m.tint}`}>
      {m.label}
    </span>
  );
}

function TableSection({ t, count }: { t: TableDef; count: number | null }) {
  const zoneTint = ZONE_META[t.zone].tint;
  return (
    <section id={t.name} className="scroll-mt-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="mono text-[14px] font-bold text-ink">{t.name}</h2>
        <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${zoneTint}`}>
          {ZONE_META[t.zone].label.split(" ")[0]}
        </span>
        {count !== null ? (
          <span className="num mono text-[10px] text-label">{count.toLocaleString()} rows</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-slate">{t.title}</p>
      <p className="text-[11px] text-muted">
        <span className="mono text-label">Source of truth:</span> {t.sourceOfTruth}
      </p>
      <p className="mt-1 max-w-[760px] text-[11px] leading-snug text-muted">{t.why}</p>

      <div className="mt-2 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-side">
              <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">Field</th>
              <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">Type</th>
              <th className="mono px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">Description</th>
            </tr>
          </thead>
          <tbody>
            {t.fields.map((f) => (
              <tr key={f.name} className="border-b border-hairline last:border-0 align-top">
                <td className="mono px-2.5 py-1 text-[11px] font-medium text-ink">{f.name}</td>
                <td className="mono px-2.5 py-1 text-[11px] text-muted">{f.type}</td>
                <td className="px-2.5 py-1 text-[11px] text-slate">
                  <span>{f.note}</span>
                  {f.tags && f.tags.length > 0 ? (
                    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                      {f.tags.map((tag) => (
                        <TagChip key={tag} tag={tag} />
                      ))}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DataDictionary() {
  const manifest = await readManifest();
  const countOf = (name: string): number | null => manifest?.counts[name] ?? null;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Data
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Data dictionary
      </h1>
      <p className="mt-1.5 max-w-[680px] text-[12px] leading-snug text-muted">
        Every table, every field. {TABLES.length} tables across four zones. Chips mark keys,
        field authority (app vs HubSpot), idempotency guards, RLS scope, and fixture-only columns.
      </p>

      <DevTabs />

      {/* legend */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mono text-[10px] uppercase tracking-[0.08em] text-label">Legend:</span>
        {(Object.keys(TAG_META) as FieldTag[]).map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-6">
        {/* sticky ToC */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            {ZONES.map((zone) => (
              <div key={zone}>
                <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                  {ZONE_META[zone].label.split(" ")[0]}
                </p>
                <ul className="mt-1 space-y-0">
                  {tablesByZone(zone).map((t) => (
                    <li key={t.name}>
                      <a href={`#${t.name}`} className="mono text-[11px] text-muted hover:text-blue">
                        {t.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* tables grouped by zone */}
        <div className="min-w-0 space-y-7">
          {ZONES.map((zone) => (
            <div key={zone} className="space-y-5">
              <div className="flex items-center gap-2">
                <span className={`mono rounded-[6px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${ZONE_META[zone].tint}`}>
                  {ZONE_META[zone].label}
                </span>
                <span className="text-[11px] text-muted">{ZONE_META[zone].blurb}</span>
              </div>
              {tablesByZone(zone).map((t) => (
                <TableSection key={t.name} t={t} count={countOf(t.name)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
