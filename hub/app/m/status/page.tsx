import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { getSession } from "@/lib/auth";
import { getProgramScopeForUser } from "@/lib/program-preference";
import { resolveViewerProgramScope, type ProgramScope } from "@/lib/program-scope";
import { buildStatusBoard } from "@/lib/status/board";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { StatusBoardClient } from "./_components/StatusBoardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Status / Exec Verdict Board | GT Marketing Hub",
};

export default async function StatusPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string; role?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const weeks = weekMondays();
  const selectedWeek = query.week && weeks.includes(query.week) ? query.week : defaultReportingWeek();

  const programScope: ProgramScope = session
    ? resolveViewerProgramScope(session.role, await getProgramScopeForUser(session.id))
    : "fall_enrollment";

  const ds = generate({ seed: 424242, families: 1200 });
  const board = buildStatusBoard(ds, programScope, selectedWeek);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
            ← Home (your cockpit)
          </Link>
          <p className="mono mt-2 text-[10px] font-semibold text-label">Command · Status / Exec Verdict Board</p>
          <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Executive verdict — funnel × spine
          </h1>
          <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
            {board.distinction.status}{" "}
            <Link href="/" className="font-semibold text-gold hover:underline">
              Home
            </Link>{" "}
            is {board.distinction.home.toLowerCase()}{" "}
            <Link href="/m/dashboard" className="font-semibold text-gold hover:underline">
              Dashboard
            </Link>{" "}
            is {board.distinction.dashboard.toLowerCase()} Program lens:{" "}
            <b className="text-ink">{board.programLabel}</b> · week of {board.weekOf}.
          </p>
        </div>
      </section>

      <StatusBoardClient board={board} />
    </main>
  );
}
