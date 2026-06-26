import Link from "next/link";
import { notFound } from "next/navigation";
import { MODULES, moduleBySlug } from "@/lib/modules";
import { DEMO_USERS, buildModuleSurface, type SurfaceMetric, type SurfaceRow } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";

const EXTRA_SLUGS = ["gt-challenge"];

export function generateStaticParams() {
  return [
    ...MODULES.filter((module) => module.slug !== "home").map((module) => ({ slug: module.slug })),
    ...EXTRA_SLUGS.map((slug) => ({ slug })),
  ];
}

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

function roleHref(slug: string, role: string) {
  return `/m/${slug}?role=${role}`;
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

  const dataset = generate({ seed: 424242, families: 1200 });
  const surface = buildModuleSurface(slug, dataset, query.role);
  const moduleDef = moduleBySlug(slug);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-7 lg:px-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="mono text-[11px] font-semibold text-gold hover:underline">
                Home
              </Link>
              <p className="mono mt-4 text-[11px] font-semibold text-label">
                {moduleDef ? `Module ${moduleDef.n}` : "Worked example"}
              </p>
              <h1 className="mt-1 font-serif text-[34px] font-semibold leading-tight text-ink">
                {surface.title}
              </h1>
              <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-muted">
                {surface.summary}
              </p>
            </div>

            <div className="rounded-card border border-hairline bg-canvas p-3">
              <p className="mono text-[11px] font-semibold text-label">
                Role lens
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEMO_USERS.map((user) => (
                  <Link
                    key={user.id}
                    href={roleHref(slug, user.role)}
                    className={`rounded-card border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                      surface.viewer.role === user.role
                        ? "border-gold bg-amber-soft text-ink"
                        : "border-hairline bg-surface text-muted hover:border-border hover:text-ink"
                    }`}
                  >
                    {user.role}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted">
                {surface.viewer.name} | {surface.viewer.title}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_320px] lg:px-9">
        <div className="space-y-5">
          {!surface.access.allowed && (
            <section className="rounded-card border border-red-soft bg-red-soft p-4 text-red">
              <p className="text-[14px] font-semibold">Access denied for this role</p>
              <p className="mt-1 text-[13px] leading-relaxed">{surface.access.reason}</p>
            </section>
          )}

          {surface.banner?.show && (
            <section className="rounded-card border border-gold bg-amber-soft p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-ink">Data confidence warning</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate">
                    {cleanCopy(surface.banner.message)}
                  </p>
                </div>
                <Link
                  href={surface.banner.href}
                  className="inline-flex h-9 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px"
                >
                  Open CRM Ops
                </Link>
              </div>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {surface.metrics.map((metric) => (
              <article key={metric.label} className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
                <div className={`mono inline-flex rounded-card border px-2 py-1 text-[11px] font-semibold ${toneClass(metric.tone)}`}>
                  {metric.label}
                </div>
                <p className="mono num mt-3 text-[26px] font-semibold leading-none text-ink">
                  {metric.value}
                </p>
                <p className="mt-2 text-[12px] leading-snug text-muted">{metric.note}</p>
              </article>
            ))}
          </section>

          {surface.sections.map((section) => (
            <section key={section.id} className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <div className="border-b border-hairline pb-3">
                <h2 className="font-serif text-[22px] font-semibold text-ink">{section.title}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{section.note}</p>
              </div>
              <div className="divide-y divide-hairline">
                {section.rows.length ? (
                  section.rows.map((row) => {
                    const content = (
                      <div className="grid gap-2 py-3 sm:grid-cols-[1fr_140px] sm:items-center">
                        <div>
                          <p className="text-[13px] font-semibold leading-snug text-ink">
                            {cleanCopy(row.label)}
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted">
                            {cleanCopy(row.note)}
                          </p>
                        </div>
                        <span className={`mono w-fit rounded-card border px-2 py-1 text-[11px] font-semibold sm:justify-self-end ${toneClass(row.tone)}`}>
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
                  <p className="py-4 text-[13px] text-muted">No rows for this section yet.</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <h2 className="font-serif text-[20px] font-semibold text-ink">Access model</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{surface.access.reason}</p>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <h2 className="font-serif text-[20px] font-semibold text-ink">Actions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {surface.actions.map((action) => (
                <span key={action} className="rounded-card border border-border bg-canvas px-2.5 py-1.5 text-[12px] font-semibold text-ink">
                  {action}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <h2 className="font-serif text-[20px] font-semibold text-ink">Source notes</h2>
            <ul className="mt-3 space-y-2">
              {surface.sourceNotes.map((note) => (
                <li key={note} className="text-[12px] leading-relaxed text-muted">
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
