import Link from "next/link";
import { notFound } from "next/navigation";
import { moduleBySlug } from "@/lib/modules";
import { buildModuleSurface, type SurfaceMetric, type SurfaceRow } from "@/lib/phase2";
import { loadDataset } from "@/lib/seed/load-dataset";
import { getSession } from "@/lib/auth";
import { summarizeQuizSubmissionsFromDb } from "@/lib/gt-challenge/store-db";

const EXTRA_SLUGS = ["gt-challenge"];

// Behind app auth (cookies()), so rendered per-request rather than statically.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const moduleDef = moduleBySlug(slug);
  if (slug === "gt-challenge") return { title: "GT Challenge | GT Marketing Hub" };
  return { title: moduleDef ? `${moduleDef.name} | GT Marketing Hub` : "GT Marketing Hub" };
}

function toneClass(tone: SurfaceMetric["tone"] | SurfaceRow["tone"] = "neutral") {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
}

function cleanCopy(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "to")
    .replace(/\u2248/g, "about")
    .replace(/\u00b7/g, "|");
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ role?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const known = moduleBySlug(slug) || EXTRA_SLUGS.includes(slug);
  if (!known || slug === "home") notFound();

  // Role is authoritative from the authenticated session. The ?role= query is only a
  // dev/test view-lens fallback used when there is no session — middleware redirects
  // unauthenticated users to /login and gates restricted routes before render, so it
  // can never escalate privilege at runtime.
  const session = await getSession();
  const role = session?.role ?? query.role;
  const dataset = await loadDataset({ seed: 424242, families: 1200 });
  // GT Challenge reads LIVE capture counts from the DB (real public-quiz submissions
  // persisted via the backbone); null on no-DB/error → the surface falls back to seed.
  const liveChallenge =
    slug === "gt-challenge" && process.env.APP_RW_DATABASE_URL
      ? await summarizeQuizSubmissionsFromDb()
      : null;
  const surface = buildModuleSurface(slug, dataset, role, liveChallenge);
  const moduleDef = moduleBySlug(slug);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
              Home
            </Link>
            <p className="mono mt-2 text-[10px] font-semibold text-label">
              {moduleDef ? `Module ${moduleDef.n}` : "Worked example"}
            </p>
            <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {surface.title}
            </h1>
            <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
              {surface.summary}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_300px] lg:px-8">
        <div className="space-y-3">
          {!surface.access.allowed && (
            <section className="rounded-card border border-red-soft bg-red-soft p-3 text-red">
              <p className="text-[12px] font-semibold">Access denied for this role</p>
              <p className="mt-1 text-[11px] leading-snug">{surface.access.reason}</p>
            </section>
          )}

          {surface.banner?.show && (
            <section className="rounded-card border border-gold bg-amber-soft p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-ink">Data confidence warning</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate">
                    {cleanCopy(surface.banner.message)}
                  </p>
                </div>
                <Link
                  href={surface.banner.href}
                  className="inline-flex h-8 items-center justify-center rounded-card bg-ink-cta px-3 text-[11px] font-semibold text-on-cta transition-transform active:translate-y-px"
                >
                  Open CRM Ops
                </Link>
              </div>
            </section>
          )}

          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {surface.metrics.map((metric) => (
              <article key={metric.label} className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
                <div className={`mono inline-flex rounded-card border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass(metric.tone)}`}>
                  {metric.label}
                </div>
                <p className="mono num mt-1.5 text-[18px] font-bold leading-none text-ink">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{metric.note}</p>
              </article>
            ))}
          </section>

          {surface.sections.map((section) => (
            <section key={section.id} className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <div className="border-b border-hairline pb-2.5">
                <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{section.title}</h2>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{section.note}</p>
              </div>
              <div className="divide-y divide-hairline">
                {section.rows.length ? (
                  section.rows.map((row) => {
                    const content = (
                      <div className="grid gap-2 py-2 sm:grid-cols-[1fr_140px] sm:items-center">
                        <div>
                          <p className="text-[12px] font-semibold leading-snug text-ink">
                            {cleanCopy(row.label)}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted">
                            {cleanCopy(row.note)}
                          </p>
                        </div>
                        <span className={`mono w-fit rounded-card border px-1.5 py-0.5 text-[10px] font-semibold sm:justify-self-end ${toneClass(row.tone)}`}>
                          {cleanCopy(row.value)}
                        </span>
                      </div>
                    );
                    return row.href ? (
                      <Link key={`${section.id}-${row.label}`} href={row.href} className="block hover:bg-hover">
                        {content}
                      </Link>
                    ) : (
                      <div key={`${section.id}-${row.label}`}>{content}</div>
                    );
                  })
                ) : (
                  <p className="py-3 text-[11px] text-muted">No rows for this section yet.</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-3">
          <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
            <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Access model</h2>
            <p className="mt-1 text-[11px] leading-snug text-muted">{surface.access.reason}</p>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
            <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Actions</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {surface.actions.map((action) => (
                <span key={action} className="rounded-card border border-border bg-canvas px-2 py-1 text-[11px] font-semibold text-ink">
                  {action}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
            <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Source notes</h2>
            <ul className="mt-2 space-y-1.5">
              {surface.sourceNotes.map((note) => (
                <li key={note} className="text-[11px] leading-snug text-muted">
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
