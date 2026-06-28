import type { ReactNode } from "react";
import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import { readTestResults, type UcStatus } from "@/lib/dev/test-results";
import {
  getUseCasesByPhase,
  getUseCaseCounts,
  type ServiceReq,
  type UseCase,
  type UseCaseStatus,
} from "@/lib/dev/usecases";
import { SUITES } from "@/lib/dev/suites";
import { ctDateTime } from "@/lib/format/datetime";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<UseCaseStatus, string> = {
  covered: "bg-green-soft text-green",
  live: "bg-blue-soft text-blue",
  pending: "bg-amber-soft text-amber",
};
const STATUS_LABEL: Record<UseCaseStatus, string> = {
  covered: "covered",
  live: "live svc",
  pending: "pending",
};

const RUN_TINT: Record<UcStatus, string> = {
  passed: "bg-green-soft text-green",
  failed: "bg-red-soft text-red",
  todo: "bg-amber-soft text-amber",
  skipped: "bg-fill text-label",
};
const RUN_MARK: Record<UcStatus, string> = {
  passed: "✓ pass",
  failed: "✕ fail",
  todo: "todo",
  skipped: "skip",
};

const REQ_LABEL: Record<ServiceReq, string> = {
  pure: "pure",
  db: "db",
  hubspot: "hubspot",
  stripe: "stripe",
  opendata: "opendata",
};

type RunTally = { passed: number; failed: number; todo: number; skipped: number; none: number };

function tally(items: UseCase[], byId?: Record<string, UcStatus>): RunTally {
  const t: RunTally = { passed: 0, failed: 0, todo: 0, skipped: 0, none: 0 };
  for (const uc of items) {
    const r = byId?.[uc.id];
    if (r) t[r] += 1;
    else t.none += 1;
  }
  return t;
}

/** Compact run pills (pass / fail / todo) for a group summary line. Hidden when zero. */
function RunPills({ t }: { t: RunTally }) {
  return (
    <span className="flex items-center gap-1">
      {t.passed > 0 && <span className="mono rounded-[4px] bg-green-soft px-1.5 py-0.5 text-[9px] font-semibold text-green">{t.passed} pass</span>}
      {t.failed > 0 && <span className="mono rounded-[4px] bg-red-soft px-1.5 py-0.5 text-[9px] font-semibold text-red">{t.failed} fail</span>}
      {t.todo > 0 && <span className="mono rounded-[4px] bg-amber-soft px-1.5 py-0.5 text-[9px] font-semibold text-amber">{t.todo} todo</span>}
    </span>
  );
}

/** A collapsible section. Open by default only when forceOpen (e.g. it contains failures). */
function Collapsible({
  kicker,
  title,
  meta,
  forceOpen = false,
  children,
}: {
  kicker: string;
  title: string;
  meta?: ReactNode;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={forceOpen} className="group mt-3 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-hover [&::-webkit-details-marker]:hidden">
        <span className="mono shrink-0 text-[10px] text-label transition-transform group-open:rotate-90">&#9656;</span>
        <span className="min-w-0">
          <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">{kicker}</span>
          <span className="block font-serif text-[14px] font-bold tracking-[-0.01em] text-ink">{title}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">{meta}</span>
      </summary>
      <div className="border-t border-hairline">{children}</div>
    </details>
  );
}

function UseCaseRow({ uc, run }: { uc: UseCase; run?: UcStatus }) {
  return (
    <div className="border-b border-hairline px-3 py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <code className="mono text-[11px] font-semibold text-slate">{uc.id}</code>
        <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${STATUS_TINT[uc.status]}`}>
          {STATUS_LABEL[uc.status]}
        </span>
        {run && (
          <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${RUN_TINT[run]}`}>
            {RUN_MARK[run]}
          </span>
        )}
        <span className="ml-auto flex flex-wrap gap-1">
          {uc.requires.map((r) => (
            <span key={r} className="mono rounded-[4px] bg-canvas px-1.5 py-0.5 text-[9px] text-label">
              {REQ_LABEL[r]}
            </span>
          ))}
          {uc.reqs.map((r) => (
            <span key={r} className="mono rounded-[4px] bg-fill px-1.5 py-0.5 text-[9px] font-semibold text-slate">
              {r}
            </span>
          ))}
        </span>
      </div>
      <h3 className="mt-1 text-[12px] font-semibold text-ink">{uc.title}</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{uc.proves}</p>
      <p className="mt-1 text-[11px] italic leading-snug text-label">{uc.brief}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {uc.tests.map((t) => (
          <code key={t} className="mono rounded-[5px] bg-canvas px-2 py-0.5 text-[10px] text-slate">{t}</code>
        ))}
      </div>
    </div>
  );
}

export default async function DevTests() {
  const counts = getUseCaseCounts();
  const groups = getUseCasesByPhase();
  const results = await readTestResults();
  const passRate =
    results && results.passed + results.failed > 0
      ? Math.round((results.passed / (results.passed + results.failed)) * 100)
      : null;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Tests
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Test Theater — the brief, made runnable
      </h1>
      <p className="mt-1.5 max-w-[720px] text-[12px] leading-snug text-muted">
        Every scenario the Technical Project Brief asks us to prove, mapped to the test that
        proves it. <span className="text-green">Covered</span> cases run with no services and
        stay green; <span className="text-blue">live</span> cases run against real
        HubSpot/Stripe/DB and skip gracefully pre-keys; <span className="text-amber">pending</span>{" "}
        cases are product features not built yet, tracked as <span className="mono">todo</span> so
        the suite is honest about the gap.
      </p>

      <DevTabs />

      {/* ============ SUMMARY (top of page) ============ */}
      <section className="mt-4 rounded-card border border-hairline bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {results ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className={`num font-serif text-[28px] font-bold leading-none ${results.failed ? "text-red" : "text-green"}`}>
                  {results.failed ? `${results.failed} failing` : "All green"}
                </span>
                {passRate != null && (
                  <span className="mono text-[11px] text-label">{passRate}% pass</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className="text-green"><b className="num">{results.passed}</b> passed</span>
                <span className={results.failed ? "text-red" : "text-muted"}><b className="num">{results.failed}</b> failed</span>
                <span className="text-amber"><b className="num">{results.todo}</b> todo</span>
                <span className="text-muted"><b className="num">{results.skipped}</b> skipped (no keys)</span>
              </div>
              {results.generatedAt && (
                <span className="ml-auto text-[10px] text-label">last run {ctDateTime(results.generatedAt)}</span>
              )}
            </>
          ) : (
            <div className="text-[12px] text-muted">
              <b className="text-ink">No run recorded.</b> Counts below are from the catalog. Run{" "}
              <code className="mono rounded bg-fill px-1.5 py-0.5 text-slate">npm run test:report</code>{" "}
              to attach live pass/fail/todo.
            </div>
          )}
        </div>

        {/* coverage counts */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Use cases", `${counts.total}`],
            ["Covered", `${counts.covered}`],
            ["Live (svc)", `${counts.live}`],
            ["Pending", `${counts.pending}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-hairline bg-canvas p-2.5">
              <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
              <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ DETAIL (collapsed by default) ============ */}
      <p className="mono mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-label">
        Detail — expand a section
      </p>

      {/* use-case phases — auto-open any phase with a failure */}
      {groups.map((g) => {
        const t = tally(g.items, results?.byId);
        return (
          <Collapsible
            key={g.phase}
            kicker={`${g.items.length} use cases`}
            title={g.phase}
            forceOpen={t.failed > 0}
            meta={<RunPills t={t} />}
          >
            {g.items.map((uc) => (
              <UseCaseRow key={uc.id} uc={uc} run={results?.byId[uc.id]} />
            ))}
          </Collapsible>
        );
      })}

      {/* suite layout */}
      <Collapsible
        kicker="Two axes"
        title="Suite layout — domain × execution"
        meta={<span className="mono text-[10px] text-label">{SUITES.length} suites</span>}
      >
        <p className="px-3 pt-2.5 text-[11px] leading-snug text-muted">
          Organized by <b className="text-ink">domain</b> (data / backend / frontend / scenarios)
          crossed with <b className="text-ink">execution</b> — <span className="text-green">pure</span>{" "}
          (no keys, always green) vs <span className="text-blue">live</span> (needs DB/HubSpot/Stripe,
          skips gracefully). The no-keys CI gate is the union of pure files:{" "}
          <code className="mono rounded bg-fill px-1.5 py-0.5 text-slate">npm run test:ci</code>.
        </p>
        <div className="grid grid-cols-1 gap-2 p-3 lg:grid-cols-2">
          {SUITES.map((s) => (
            <div key={s.id} className="rounded-card border border-hairline bg-canvas p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[12px] font-semibold text-ink">{s.label}</h3>
                <code className="mono text-[10px] text-blue">{s.script}</code>
              </div>
              <p className="mt-0.5 text-[11px] text-muted">{s.domain}</p>
              <div className="mt-2 space-y-1">
                {s.files.length === 0 ? (
                  <p className="text-[11px] italic text-label">No tests yet — add component/page tests here.</p>
                ) : (
                  s.files.map((f) => (
                    <div key={f.file} className="flex items-start gap-2">
                      <span className={`mono mt-0.5 shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${f.kind === "pure" ? "bg-green-soft text-green" : "bg-blue-soft text-blue"}`}>
                        {f.kind === "live" ? `live·${f.needs.join("+")}` : "pure"}
                      </span>
                      <div className="min-w-0">
                        <code className="mono text-[11px] text-slate">{f.file.replace("tests/", "")}</code>
                        <p className="text-[11px] leading-snug text-muted">{f.what}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* how to run */}
      <Collapsible kicker="Reproducible" title="Run the suite">
        {[
          ["npm test", "Run the whole suite (live cases skip without keys)."],
          ["npx vitest run tests/brief-usecases.test.ts", "Just the brief use cases (pure, always green)."],
          ["npm run test:report", "Write seed-data/test-results.json to light up this page."],
          ["npm run verify", "build + lint + test:ci — the reproducible pre-submission gate."],
        ].map(([cmd, what]) => (
          <div key={cmd} className="flex flex-col gap-0.5 border-b border-hairline px-3 py-2 last:border-0 sm:flex-row sm:items-center sm:gap-4">
            <code className="mono shrink-0 text-[11px] text-ink sm:w-[380px]">{cmd}</code>
            <span className="text-[11px] text-muted">{what}</span>
          </div>
        ))}
      </Collapsible>

      <footer className="mt-6 border-t border-hairline pt-3 text-[11px] text-label">
        Catalog: <span className="mono">lib/dev/usecases.ts</span> · Runnable proofs:{" "}
        <span className="mono">tests/brief-usecases.test.ts</span> · Requirements:{" "}
        <span className="mono">docs/01-intake/REQUIREMENTS.md</span> ·{" "}
        <Link href="/dev" className="text-blue hover:underline">data overview →</Link>
      </footer>
    </div>
  );
}
