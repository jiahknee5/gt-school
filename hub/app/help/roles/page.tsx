import Link from "next/link";
import { moduleBySlug, moduleHref } from "@/lib/modules";
import {
  AGENDA,
  AGENDA_TOTAL_MINUTES,
  NAV_SCOPE_DOCS,
  PERMISSION_TIERS,
  navSections,
  roleOwnershipMatrix,
} from "@/lib/help/roles";

export const metadata = {
  title: "Roles & access - GT Marketing Hub",
};

const TIER_TINT: Record<string, string> = {
  admin: "bg-blue-soft text-blue",
  leader: "bg-violet-soft text-violet",
  operator: "bg-green-soft text-green",
};

function ModuleChips({ slugs }: { slugs: { slug: string; short: string }[] }) {
  if (slugs.length === 0) {
    return <span className="mono text-[11px] text-label">All / personal</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {slugs.map((m) => (
        <Link
          key={m.slug}
          href={moduleHref(m.slug)}
          className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate transition-colors hover:text-gold"
        >
          {m.short}
        </Link>
      ))}
    </div>
  );
}

export default function RolesPage() {
  const matrix = roleOwnershipMatrix();
  const sections = navSections();

  return (
    <div className="mx-auto max-w-[1080px] px-7 py-10">
      <Link href="/help" className="mono text-[10px] text-blue hover:underline">
        &larr; All guides
      </Link>

      <p className="mono mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / Roles &amp; access
      </p>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
        How the Hub is organized
      </h1>
      <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-muted">
        The Hub is organized around the weekly marketing meeting. This page documents the
        agenda &rarr; module mapping, the agenda-aware menu, the two ways a user is described
        (a security permission tier and a functional org role), and which person owns which
        module.
      </p>

      {/* 1. Weekly meeting agenda → module mapping */}
      <section className="mt-12">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          The organizing source of truth
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">
          Weekly meeting agenda &rarr; modules
        </h2>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
          PRD &sect;5. Eight agenda items, {AGENDA_TOTAL_MINUTES} minutes total, each driven from a
          Hub module. The sidebar reads top-to-bottom in roughly this flow.
        </p>

        <div className="mt-4 overflow-hidden rounded-card border border-hairline">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="bg-fill">
              <tr className="mono text-[10px] uppercase tracking-[0.08em] text-label">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Agenda item</th>
                <th className="px-3 py-2 font-semibold">Min</th>
                <th className="px-3 py-2 font-semibold">Owner</th>
                <th className="px-3 py-2 font-semibold">Module(s)</th>
              </tr>
            </thead>
            <tbody>
              {AGENDA.map((a) => {
                const mods = a.moduleSlugs
                  .map((slug) => moduleBySlug(slug))
                  .filter((m): m is NonNullable<typeof m> => Boolean(m));
                return (
                  <tr key={a.slot} className="border-t border-hairline align-top">
                    <td className="num px-3 py-2.5 font-semibold text-ink">{a.slot}</td>
                    <td className="px-3 py-2.5 text-ink">{a.item}</td>
                    <td className="num px-3 py-2.5 text-slate">{a.minutes}</td>
                    <td className="px-3 py-2.5 text-slate">{a.owner}</td>
                    <td className="px-3 py-2.5">
                      <ModuleChips slugs={mods.map((m) => ({ slug: m.slug, short: m.short }))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-label">
          Off-agenda modules still have a home and an owner: Summer Camp, Field &amp; Events,
          Budget, and Resource Library.
        </p>
      </section>

      {/* 2. Menu / sidebar structure */}
      <section className="mt-12">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          Finding your way around
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">
          The menu, in agenda order
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {sections.map(({ group, modules }) => (
            <div key={group.key} className="rounded-card border border-hairline bg-surface p-4">
              <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                {group.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{group.description}</p>
              <ul className="mt-2.5 space-y-1">
                {modules.map((m) => (
                  <li key={m.slug} className="flex items-center justify-between gap-2 text-[12px]">
                    <Link href={moduleHref(m.slug)} className="text-ink hover:text-gold">
                      {m.short}
                    </Link>
                    {m.leaderOnly && (
                      <span className="mono rounded-card bg-violet-soft px-1.5 py-px text-[9px] font-semibold text-violet">
                        Leader
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Two layers: permission tier vs functional role */}
      <section className="mt-12">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          Two ways a user is described
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">
          Permission tier vs. functional role
        </h2>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
          These are orthogonal. The <span className="font-semibold text-ink">permission tier</span>{" "}
          (admin / leader / operator) is the security gate enforced on every route. The{" "}
          <span className="font-semibold text-ink">functional role</span> (Content Owner, Grassroots
          Owner, &hellip;) is the org/job layer the agenda is organized around &mdash; it is
          descriptive, not a permission grant.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {PERMISSION_TIERS.map((tier) => (
            <div key={tier.role} className="flex flex-col rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-ink">{tier.label}</h3>
                <span className={`mono rounded-card px-1.5 py-0.5 text-[10px] font-semibold ${TIER_TINT[tier.role] ?? "bg-fill text-slate"}`}>
                  {tier.role}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted">{tier.who}</p>
              <p className="mono mt-3 text-[10px] uppercase tracking-[0.08em] text-label">Can</p>
              <ul className="mt-1 space-y-1">
                {tier.can.map((c) => (
                  <li key={c} className="flex gap-1.5 text-[11px] leading-snug text-slate">
                    <span className="mt-0.5 text-green">+</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="mono mt-3 text-[10px] uppercase tracking-[0.08em] text-label">Cannot</p>
              <ul className="mt-1 space-y-1">
                {tier.cannot.map((c) => (
                  <li key={c} className="flex gap-1.5 text-[11px] leading-snug text-slate">
                    <span className="mt-0.5 text-amber">!</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 3b. Admin assignment + nav scope */}
      <section className="mt-12">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          Assignment &amp; menu view
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">
          Multi-role profiles &amp; sidebar view
        </h2>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
          Each user has a <strong>permission tier</strong> (admin / leader / operator) assigned
          only by Admin via <span className="mono">/dev/profiles</span>. They may also hold{" "}
          <strong>multiple functional roles</strong> (e.g. Grassroots Owner + Content Owner) and
          explicit module ownership. Functional roles describe org scope — they do not replace
          security gates.
        </p>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
          The sidebar <strong>View</strong> control filters which modules appear in the menu.
          This is a soft declutter: operators still have read access to all modules per PRD
          &sect;2; use <em>All modules</em> to see the full list. Your view choice is saved
          per user.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {NAV_SCOPE_DOCS.map((doc) => (
            <div key={doc.scope} className="rounded-card border border-hairline bg-surface p-3">
              <p className="text-[13px] font-semibold text-ink">{doc.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{doc.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Ownership matrix / seed users */}
      <section className="mt-12">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          Who owns what
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">
          People &rarr; tier &rarr; functional role &rarr; modules
        </h2>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
          The seeded users and the modules they own. Owners present their module in the
          weekly meeting and are accountable for its numbers.
        </p>

        <div className="mt-4 overflow-hidden rounded-card border border-hairline">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="bg-fill">
              <tr className="mono text-[10px] uppercase tracking-[0.08em] text-label">
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Functional role</th>
                <th className="px-3 py-2 font-semibold">Owns modules</th>
                <th className="px-3 py-2 font-semibold">Agenda</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(({ user, modules }) => (
                <tr key={user.id} className="border-t border-hairline align-top">
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-ink">{user.name}</span>
                    <br />
                    <span className="mono text-[10px] text-label">{user.title}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`mono rounded-card px-1.5 py-0.5 text-[10px] font-semibold ${TIER_TINT[user.role] ?? "bg-fill text-slate"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate">{user.functionalRoles.join(", ")}</td>
                  <td className="px-3 py-2.5">
                    <ModuleChips slugs={modules.map((m) => ({ slug: m.slug, short: m.short }))} />
                  </td>
                  <td className="num px-3 py-2.5 text-slate">
                    {user.agendaSlots.length ? user.agendaSlots.join(", ") : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-12 border-t border-hairline pt-5 text-[12px] text-label">
        Roles &amp; agenda: <span className="mono">lib/help/roles.ts</span> / Modules &amp; IA:{" "}
        <span className="mono">lib/modules.ts</span> / Users &amp; RBAC:{" "}
        <span className="mono">lib/phase2.ts</span>, <span className="mono">lib/auth/policy.ts</span>
      </footer>
    </div>
  );
}
