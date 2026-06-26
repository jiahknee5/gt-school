import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Access denied | GT Marketing Hub" };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const reason = query.reason ?? "You do not have access to this surface.";

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas px-4 py-8">
      <div className="w-full max-w-[460px] text-center">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-red">
          403 — Access denied
        </p>
        <h1 className="mt-2 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
          This surface is restricted
        </h1>
        <p className="mt-2 text-[12px] leading-snug text-muted">{reason}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-8 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px"
          >
            Back to Home
          </Link>
          <Link
            href="/login"
            prefetch={false}
            className="inline-flex h-8 items-center justify-center rounded-card border border-border bg-canvas px-3 text-[12px] font-semibold text-ink"
          >
            Switch role
          </Link>
        </div>
      </div>
    </main>
  );
}
