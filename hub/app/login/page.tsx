import Image from "next/image";
import { AUTH_PROFILES, DEV_MODE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in | GT Marketing Hub" };

const ROLE_BLURB: Record<string, string> = {
  admin: "Marketing Lead with full access to every module and internal/dev surfaces.",
  leader: "Growth leader with Decision Queue view + act access and broad read access.",
  operator: "Module owner with read/write access to owned modules, read-only elsewhere, and submit-only decisions.",
};

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const next = safeNext(query.next);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas px-4 py-8">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center gap-2.5">
          <Image
            src="/gt-school-logo.svg"
            alt="GT School"
            width={139}
            height={32}
            priority
            unoptimized
            className="h-7 w-auto"
          />
          <span className="h-6 w-px bg-hairline" />
          <span className="text-[13px] font-semibold text-muted">Marketing Hub</span>
        </div>

        <h1 className="mt-4 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Sign in
        </h1>

        {DEV_MODE ? (
          <>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">
              Dev auth mode is on. Pick a role to start a real, server-enforced session.
              Every route stays deny-by-default behind this session.
            </p>
            <div className="mt-4 space-y-2">
              {AUTH_PROFILES.map((user) => (
                // A plain <a> (full-page navigation), NOT next/link: login hits a route
                // handler that sets the session cookie and redirects. A client-side <Link>
                // nav applies the cookie but keeps the cached signed-out layout/nav until a
                // hard refresh — the "have to refresh to sign in" bug. A document load
                // renders the destination fresh with the new session.
                //
                // Sign in as the EXACT named user (by id). Logging in by role would
                // re-resolve to the alphabetically-first profile of that role, so a
                // multi-user role (3 leaders / 4 operators) would land the wrong person.
                <a
                  key={user.id}
                  href={`/api/auth/login?userId=${user.id}&next=${encodeURIComponent(next)}`}
                  className="block rounded-card border border-hairline bg-surface p-3 shadow-sm transition-colors hover:border-border hover:bg-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-ink">{user.name}</p>
                    <span className="mono rounded-card bg-fill px-1.5 py-0.5 text-[10px] font-semibold text-slate">
                      {user.role}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {ROLE_BLURB[user.role] ?? user.title}
                  </p>
                </a>
              ))}
            </div>
            <p className="mono mt-4 text-[11px] leading-snug text-label">
              Dev mode is for the competition demo only. In production set
              AUTH_DEV_MODE=false and wire a real identity provider; the same
              middleware and role checks apply unchanged.
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[12px] leading-snug text-muted">
            No identity provider is configured for this deployment. Set AUTH_DEV_MODE=true
            for local development, or connect a real IdP.
          </p>
        )}

        <p className="mt-6 border-t border-hairline pt-4 text-[11px] leading-snug text-label">
          Internal marketing operations workspace for{" "}
          <a
            href="https://gt.school"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-muted underline-offset-2 hover:underline"
          >
            GT School
          </a>{" "}
          , a K-8 microschool for gifted learners in the{" "}
          <a
            href="https://alpha.school"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-muted underline-offset-2 hover:underline"
          >
            Alpha School
          </a>{" "}
          family, powered by 2 Hour Learning.
        </p>
      </div>
    </main>
  );
}
