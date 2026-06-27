import Link from "next/link";
import { redirect } from "next/navigation";
import { DevRoleSwitch } from "@/app/_components/DevRoleSwitch";
import { DEV_MODE, getSession } from "@/lib/auth";
import { MODULES, moduleHref } from "@/lib/modules";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your profile - GT Marketing Hub",
};

const TIER_TINT: Record<string, string> = {
  admin: "bg-blue-soft text-blue",
  leader: "bg-violet-soft text-violet",
  operator: "bg-green-soft text-green",
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/profile");
  }

  const ownedModules = MODULES.filter((m) => session.ownsModules.includes(m.slug));

  return (
    <div className="mx-auto max-w-[880px] px-7 py-10">
      <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Your profile
      </p>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
        {session.name}
      </h1>
      <p className="mt-1 text-[14px] text-muted">{session.title}</p>

      {/* Identity card */}
      <section className="mt-8 rounded-card border border-hairline bg-surface p-5 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.08em] text-label">Permission tier</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`mono rounded-card px-1.5 py-0.5 text-[11px] font-semibold ${
                  TIER_TINT[session.role] ?? "bg-fill text-slate"
                }`}
              >
                {session.role}
              </span>
              <span className="text-[12px] text-muted">the security gate on every route</span>
            </div>
          </div>
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.08em] text-label">Functional role(s)</p>
            <p className="mt-1.5 text-[13px] text-ink">
              {session.functionalRoles.length ? session.functionalRoles.join(", ") : "\u2014"}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-hairline pt-4">
          <p className="mono text-[10px] uppercase tracking-[0.08em] text-label">Owns modules</p>
          {ownedModules.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ownedModules.map((m) => (
                <Link
                  key={m.slug}
                  href={moduleHref(m.slug)}
                  className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[10px] text-slate transition-colors hover:text-gold"
                >
                  {m.short}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[12px] text-muted">No directly owned modules &mdash; all / personal access.</p>
          )}
        </div>

        <p className="mt-5 text-[12px] leading-snug text-label">
          See what each tier can and cannot do on the{" "}
          <Link href="/help/roles" className="font-semibold text-blue hover:underline">
            Roles &amp; access
          </Link>{" "}
          page. Permission tiers are assigned by Admin in{" "}
          <span className="mono">/dev/profiles</span>.
        </p>
      </section>

      {/* Dev role switch — relocated here from the top header (PRD A5). */}
      {DEV_MODE && (
        <section className="mt-8">
          <h2 className="font-serif text-[20px] font-bold tracking-[-0.01em] text-ink">
            Switch role (dev)
          </h2>
          <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-muted">
            Dev auth mode is on. Switching mints a real, server-enforced session as a seeded
            user for that tier &mdash; the same middleware and role checks apply unchanged.
            This is the entry point reviewers use to test all three roles.
          </p>
          <div className="mt-4">
            <DevRoleSwitch currentRole={session.role} />
          </div>
          <p className="mono mt-3 text-[11px] leading-snug text-label">
            Also available on the{" "}
            <Link href="/help/roles" className="font-semibold text-blue hover:underline">
              Roles &amp; access
            </Link>{" "}
            page. In production set <span className="mono">AUTH_DEV_MODE=false</span> and wire a
            real identity provider.
          </p>
        </section>
      )}
    </div>
  );
}
