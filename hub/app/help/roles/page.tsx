import Link from "next/link";
import { DevRoleSwitch } from "@/app/_components/DevRoleSwitch";
import { DEV_MODE, getSession } from "@/lib/auth";
import { moduleHref } from "@/lib/modules";
import {
  NAV_SCOPE_DOCS,
  PERMISSION_TIERS,
  roleOwnershipMatrix,
} from "@/lib/help/roles";

export const dynamic = "force-dynamic";

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
    return <span className="mono text-[10px] text-label">All / personal</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
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

export default async function RolesPage() {
  const matrix = roleOwnershipMatrix();
  const session = await getSession();

  return (
    <div className="mx-auto max-w-[960px] px-6 py-8">
      <Link href="/help" className="mono text-[10px] text-blue hover:underline">
        &larr; All guides
      </Link>

      <p className="mono mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / Roles &amp; access
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Roles &amp; access
      </h1>
      <p className="mt-1.5 max-w-[680px] text-[12px] leading-snug text-muted">
        Who can see and do what. A user is described two ways: a{" "}
        <span className="font-semibold text-ink">permission tier</span> (admin / leader / operator) —
        the security gate enforced on every route — and a{" "}
        <span className="font-semibold text-ink">functional role</span> (Content Owner, Grassroots
        Owner, &hellip;), the descriptive org layer. The Hub&rsquo;s layout follows the Monday
        meeting &mdash; see{" "}
        <Link href="/help/weekly-meeting" className="font-semibold text-blue hover:underline">
          Run the Monday meeting
        </Link>
        .
      </p>

      {/* 1. The three permission tiers */}
      <section className="mt-8">
        <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">
          The three permission tiers
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Deny-by-default. The tier is the only thing that grants access; functional roles never do.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {PERMISSION_TIERS.map((tier) => (
            <div key={tier.role} className="flex flex-col rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-ink">{tier.label}</h3>
                <span className={`mono rounded-card px-1.5 py-0.5 text-[10px] font-semibold ${TIER_TINT[tier.role] ?? "bg-fill text-slate"}`}>
                  {tier.role}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted">{tier.who}</p>
              <ul className="mt-2 space-y-1">
                {tier.can.map((c) => (
                  <li key={c} className="flex gap-1.5 text-[11px] leading-snug text-slate">
                    <span className="mt-px text-green">+</span>
                    <span>{c}</span>
                  </li>
                ))}
                {tier.cannot.map((c) => (
                  <li key={c} className="flex gap-1.5 text-[11px] leading-snug text-slate">
                    <span className="mt-px text-amber">!</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Tier vs functional role + assignment + sidebar view */}
      <section className="mt-8">
        <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">
          Tier vs. functional role &mdash; and the sidebar view
        </h2>
        <p className="mt-1 max-w-[680px] text-[12px] leading-snug text-muted">
          The two are orthogonal. Admin assigns the <strong>permission tier</strong> via{" "}
          <span className="mono">/dev/profiles</span>; a user may also hold several{" "}
          <strong>functional roles</strong> (e.g. Grassroots + Content Owner) with explicit module
          ownership. Functional roles describe org scope &mdash; they don&rsquo;t replace security
          gates. The sidebar <strong>View</strong> control is a soft declutter only: operators keep
          read access to all modules (PRD &sect;2); pick <em>All modules</em> to see everything. Your
          choice is saved per user.
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {NAV_SCOPE_DOCS.map((doc) => (
            <div key={doc.scope} className="rounded-card border border-hairline bg-surface p-3">
              <p className="text-[12px] font-semibold text-ink">{doc.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{doc.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Ownership matrix / seed users */}
      <section className="mt-8">
        <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">
          Who owns what
        </h2>
        <p className="mt-1 max-w-[680px] text-[11px] leading-snug text-muted">
          The seeded users, their tier, functional role, and the modules they own and are
          accountable for.
        </p>
        <div className="mt-3 overflow-hidden rounded-card border border-hairline">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="bg-fill">
              <tr className="mono text-[10px] uppercase tracking-[0.08em] text-label">
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Functional role</th>
                <th className="px-3 py-2 font-semibold">Owns modules</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(({ user, modules }) => (
                <tr key={user.id} className="border-t border-hairline align-top">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-ink">{user.name}</span>
                    <br />
                    <span className="mono text-[10px] text-label">{user.title}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`mono rounded-card px-1.5 py-0.5 text-[10px] font-semibold ${TIER_TINT[user.role] ?? "bg-fill text-slate"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate">{user.functionalRoles.join(", ")}</td>
                  <td className="px-3 py-2">
                    <ModuleChips slugs={modules.map((m) => ({ slug: m.slug, short: m.short }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Dev role switch */}
      {DEV_MODE && (
        <section className="mt-8">
          <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">
            Switch role (dev)
          </h2>
          <p className="mt-1 max-w-[680px] text-[11px] leading-snug text-muted">
            Dev auth mode is on. Pick a tier to start a real, server-enforced session as a seeded
            user &mdash; the same middleware and checks apply &mdash; the quickest way to verify what
            each tier can and cannot do. Also available from{" "}
            <Link href="/profile" className="font-semibold text-blue hover:underline">
              your profile
            </Link>
            .
          </p>
          <div className="mt-3">
            <DevRoleSwitch currentRole={session?.role ?? null} />
          </div>
        </section>
      )}

      <footer className="mt-8 border-t border-hairline pt-4 text-[11px] text-label">
        Roles: <span className="mono">lib/help/roles.ts</span> / Users &amp; RBAC:{" "}
        <span className="mono">lib/phase2.ts</span>, <span className="mono">lib/auth/policy.ts</span>
      </footer>
    </div>
  );
}
