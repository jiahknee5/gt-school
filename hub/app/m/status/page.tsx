import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { getSession } from "@/lib/auth";
import { getProgramScopeForUser } from "@/lib/program-preference";
import { resolveViewerProgramScope, type ProgramScope } from "@/lib/program-scope";
import { buildStatusBoard } from "@/lib/status/board";
import { loadOrGenerateSnapshot } from "@/lib/status/store";
import { applySnapshotToBoard } from "@/lib/status/generate";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { StatusBoardClient } from "./_components/StatusBoardClient";
import { StatusWeekBar } from "./_components/StatusWeekBar";

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
  const currentWeek = defaultReportingWeek();
  const selectedWeek = query.week && weeks.includes(query.week) ? query.week : currentWeek;
  const isCurrent = selectedWeek === currentWeek;

  const programScope: ProgramScope = session
    ? resolveViewerProgramScope(session.role, await getProgramScopeForUser(session.id))
    : "fall_enrollment";

  const ds = generate({ seed: 424242, families: 1200 });
  const board = buildStatusBoard(ds, programScope, selectedWeek);

  // Pre-loaded verdict: serve the stored snapshot for this week if one exists (recall),
  // else generate it on view (deterministic with no key). Overlay it onto the numbers.
  const { snapshot, recalled } = await loadOrGenerateSnapshot(board, programScope);
  applySnapshotToBoard(board, snapshot, { recalled, isCurrent });

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6 lg:px-8">
          <p className="mono text-[10px] font-semibold text-label">Command · Status</p>
          <h1 className="font-serif text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Executive verdict — funnel × spine
          </h1>
          <p className="text-[11px] leading-snug text-muted">
            vs your{" "}
            <Link href="/" className="font-semibold text-gold hover:underline">
              Home
            </Link>{" "}
            (personal cockpit) and{" "}
            <Link href="/m/dashboard" className="font-semibold text-gold hover:underline">
              Dashboard
            </Link>{" "}
            (weekly scorecard) · <b className="text-ink">{board.programLabel}</b> · week of {board.weekOf}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
        <StatusWeekBar
          weeks={weeks}
          selectedWeek={selectedWeek}
          currentWeek={currentWeek}
          meta={board.snapshotMeta}
        />
      </div>

      <StatusBoardClient board={board} selectedWeek={selectedWeek} />
    </main>
  );
}
