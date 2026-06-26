// Module 12 — Resource Library. Deliberately the simplest module: a flat, tag-filterable
// shelf. Library owns metadata only; download counts are read-only from Analytics (never
// fabricated). visibility is enforced at the query layer (an Operator never receives a
// leadership-only row). Dead links surface a visible "link unreachable" state. No
// data-confidence banner here (no HubSpot parity input).

import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { getSession } from "@/lib/auth";
import { Card, MetricTile, ModuleHeader, Pill } from "@/app/_components/modkit";
import { SAMPLE_RESOURCES } from "@/lib/library/data";
import { TAGS, type Tag } from "@/lib/library/types";
import { visibleResources, canUpload } from "@/lib/library/rbac";
import { searchResources, filterResources } from "@/lib/library/search";
import { downloadChip } from "@/lib/library/access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resource Library | GT Marketing Hub" };

const BADGE_TONE: Record<string, "good" | "neutral" | "watch"> = {
  DOC: "neutral",
  SHEET: "good",
  SLIDES: "watch",
  PDF: "neutral",
  MD: "neutral",
  HTML: "neutral",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; tag?: string; role?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const role = session?.role ?? (query.role as "admin" | "leader" | "operator" | undefined);
  const viewer = session ?? demoUserByRole(role);

  const ds = generate({ seed: 424242, families: 1200 });

  // visibility FIRST (query-layer RBAC), then search + facet
  let resources = visibleResources(SAMPLE_RESOURCES, viewer.role);
  const q = query.q ?? "";
  const tag = TAGS.includes(query.tag as Tag) ? (query.tag as Tag) : undefined;
  if (q) resources = searchResources(resources, q);
  if (tag) resources = filterResources(resources, { tag });

  const total = visibleResources(SAMPLE_RESOURCES, viewer.role).length;
  const deadLinks = resources.filter((r) => !r.linkOk).length;
  const hrefFor = (t?: Tag) => `/m/library${t ? `?tag=${t}` : ""}`;

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={12}
        title="Resource Library"
        blurb="A flat, tag-filterable shelf of plans, decks, trackers, and dossiers. The Library owns metadata only — download counts are read-only from Analytics and never fabricated. Visibility is enforced at the query layer, so leadership-only resources never reach an Operator. Dead links surface a visible 'unreachable' state."
        viewerName={viewer.name}
        viewerTitle={viewer.title}
        viewerRole={viewer.role}
      />

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <section className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="Resources" value={String(total)} note="you can see" tone="neutral" />
              <MetricTile label="Showing" value={String(resources.length)} note={q || tag ? "filtered" : "all"} tone="good" />
              <MetricTile label="Dead links" value={String(deadLinks)} note="flagged unreachable" tone={deadLinks ? "risk" : "good"} />
            </section>

            <Card title="Find a resource" note="Search spans title, description, tags, and owner (case/diacritic-insensitive). Filter by tag.">
              <form method="get" className="flex flex-wrap gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Search resources…"
                  className="h-9 flex-1 rounded-card border border-hairline bg-canvas px-3 text-[12px] text-ink"
                />
                {viewer.role && <input type="hidden" name="role" value={viewer.role} />}
                <button type="submit" className="h-9 rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta">Search</button>
              </form>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <a href={hrefFor()} className={`rounded-card border px-2.5 py-1 text-[11px] font-semibold ${!tag ? "border-gold bg-amber-soft text-ink" : "border-hairline text-muted"}`}>all</a>
                {TAGS.map((t) => (
                  <a key={t} href={hrefFor(t)} className={`rounded-card border px-2.5 py-1 text-[11px] font-semibold ${tag === t ? "border-gold bg-amber-soft text-ink" : "border-hairline text-muted"}`}>{t}</a>
                ))}
              </div>
            </Card>

            {resources.length === 0 ? (
              <Card title="No matches" note={q ? `Nothing matched “${q}”.` : "No resources under this filter."}>
                <p className="text-[11px] text-muted">Try a different search or clear the tag filter.</p>
              </Card>
            ) : (
              <section className="grid gap-2 sm:grid-cols-2">
                {resources.map((r) => {
                  const chip = downloadChip(r, ds);
                  return (
                    <article key={r.id} className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[14px] font-semibold text-ink">{r.title}</h3>
                        <Pill tone={BADGE_TONE[r.fileType]}>{r.fileType}</Pill>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{r.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <span key={t} className="rounded-card border border-hairline bg-fill px-2 py-0.5 text-[11px] text-slate">{t}</span>
                        ))}
                        {r.visibility === "leadership" && <Pill tone="watch">leadership-only</Pill>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                        <span>{r.owner} · {r.createdAt.slice(0, 10)}</span>
                        {chip !== null && <span className="text-gold">↓ {chip} this week</span>}
                      </div>
                      {r.linkOk ? (
                        <a href={r.url ?? "#"} className="mt-2 inline-flex text-[12px] font-semibold text-gold hover:underline">Open →</a>
                      ) : (
                        <p className="mt-2 text-[12px] font-semibold text-red">⚠ link unreachable</p>
                      )}
                    </article>
                  );
                })}
              </section>
            )}
          </div>

          <aside className="space-y-3">
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Add a resource</h2>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                {canUpload(viewer.role)
                  ? "Anyone can upload: title + ≥1 tag + visibility + a URL or file. Owner and date auto-fill; the badge is derived from the link."
                  : "Sign in to upload a resource."}
              </p>
              {canUpload(viewer.role) && <Pill tone="good">+ Add resource</Pill>}
            </section>
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">How this shelf works</h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
                <li>Library owns metadata only; counts are read-only from Analytics.</li>
                <li>Visibility is enforced at the query layer (no leadership leak).</li>
                <li>Badges are derived from the URL/MIME — never typed.</li>
                <li>Flat by design: no versioning, approval, or automation.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
