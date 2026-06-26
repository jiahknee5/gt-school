import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, guideBySlug } from "@/lib/help/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  return { title: guide ? `${guide.title} - Help` : "Help" };
}

function cleanCopy(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, " to ")
    .replace(/\u2194/g, " and ")
    .replace(/\u00b7/g, "/");
}

function Chips({ items, tint }: { items: string[]; tint: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className={`mono rounded-[5px] px-1.5 py-0.5 text-[10px] ${tint}`}>
          {it}
        </span>
      ))}
    </div>
  );
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const related = guide.related
    .map((s) => guideBySlug(s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <Link href="/help" className="mono text-[11px] text-blue hover:underline">
        ← All guides
      </Link>

      <p className="mono mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        {guide.category}
      </p>
      <h1 className="mt-2 font-serif text-[30px] font-bold leading-tight tracking-[-0.02em] text-ink">
        {guide.title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{cleanCopy(guide.objective)}</p>

      {guide.fromSpec && (
        <div className="mt-5 rounded-card border border-gold bg-fill px-4 py-3 text-[12px] leading-relaxed text-ink">
          <span className="mono font-semibold uppercase tracking-[0.08em] text-gold">From the spec</span>{" "}
          - {cleanCopy(guide.fromSpec)}
        </div>
      )}

      {/* meta */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-label">Who</p>
          <div className="mt-1.5">
            <Chips items={guide.who} tint="bg-fill text-slate" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-label">Modules it spans</p>
          <div className="mt-1.5">
            <Chips items={guide.modules} tint="bg-fill text-slate" />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted">
        <span className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">Starts when</span>
        <br />
        {cleanCopy(guide.trigger)}
      </div>

      {/* steps */}
      <h2 className="mt-10 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">Steps</h2>
      <ol className="mt-5 space-y-4">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-4 rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-cta text-[13px] font-bold text-on-cta">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-snug text-ink">{cleanCopy(step.do)}</p>
              <p className="mono mt-1.5 text-[11px] text-slate">{cleanCopy(step.where)}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-slate">Result:</span> {cleanCopy(step.result)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* success */}
      <h2 className="mt-10 font-serif text-[20px] font-bold tracking-[-0.01em] text-ink">
        What good looks like
      </h2>
      <ul className="mt-3 space-y-2">
        {guide.success.map((s) => (
          <li key={s} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
            <span className="mono mt-0.5 text-[10px] font-semibold uppercase text-gold">Good</span>
            <span>{cleanCopy(s)}</span>
          </li>
        ))}
      </ul>

      {/* watch for */}
      <h2 className="mt-8 font-serif text-[20px] font-bold tracking-[-0.01em] text-ink">Watch for</h2>
      <ul className="mt-3 space-y-2">
        {guide.watchFor.map((w) => (
          <li key={w} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
            <span className="mt-0.5 text-amber">!</span>
            <span>{cleanCopy(w)}</span>
          </li>
        ))}
      </ul>

      {/* related */}
      {related.length > 0 && (
        <>
          <h2 className="mt-10 font-serif text-[18px] font-bold tracking-[-0.01em] text-ink">Related guides</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/help/${r.slug}`}
                className="rounded-card border border-hairline bg-surface px-3 py-1.5 text-[12px] text-slate transition-colors hover:border-gold hover:text-gold"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
