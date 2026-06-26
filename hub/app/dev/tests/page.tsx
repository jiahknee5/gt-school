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
  passed: "\u2713 pass",
  failed: "\u2715 fail",
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

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mt-12">
      <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">{kicker}</p>
      <h2 className="mt-1.5 font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
    </div>
  );
}

function UseCaseRow({ uc, run }: { uc: UseCase; run?: UcStatus }) {
  return (
    <div className="border-b border-hairline px-4 py-3.5 last:border-0">
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
      <h3 className="mt-1.5 text-[14px] font-semibold text-ink">{uc.title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{uc.proves}</p>
      <p className="mt-1.5 text-[11px] italic leading-relaxed text-label">{uc.brief}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
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

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-10">
      <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Tests
      </p>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Test Theater — the brief, made runnable
      </h1>
      <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-muted">
        Every scenario the Technical Project Brief asks us to prove, mapped to the test that
        proves it. <span className="text-green">Covered</span> cases run with no services and
        stay green; <span className="text-blue">live</span> cases run against real
        HubSpot/Stripe/DB and skip gracefully pre-keys; <span className="text-amber">pending</span>{" "}
        cases are product features not built yet, tracked as <span className="mono">todo</span> so
        the suite is honest about the gap.
      </p>

      <DevTabs />

      {/* ---- coverage summary ---- */}
      <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[
          ["Use cases", `${counts.total}`],
          ["Covered", `${counts.covered}`],
          ["Live (svc)", `${counts.live}`],
          ["Pending", `${counts.pending}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-4">
            <div className="mono text-[11px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-1 font-serif text-[24px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      {/* ---- last run ---- */}
      {results ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-card border border-hairline bg-surface px-4 py-3 text-[12px]">
          <span className="mono text-[11px] uppercase tracking-[0.1em] text-label">Last run</span>
          <span className="text-green"><b className="num">{results.passed}</b> passed</span>
          <span className={results.failed ? "text-red" : "text-muted"}><b className="num">{results.failed}</b> failed</span>
          <span className="text-amber"><b className="num">{results.todo}</b> todo</span>
          <span className="text-muted"><b className="num">{results.skipped}</b> skipped (no keys)</span>
          {results.generatedAt && (
            <span className="ml-auto text-label">{new Date(results.generatedAt).toLocaleString()}</span>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-card border border-hairline bg-surface p-4 text-[13px] text-muted">
          <b className="text-ink">No run recorded.</b> Statuses below are from the catalog. Run{" "}
          <code className="mono rounded bg-fill px-1.5 py-0.5 text-slate">npm run test:report</code>{" "}
          to attach live pass/fail/todo per use case.
        </div>
      )}

      {/* ---- suite layout ---- */}
      <SectionTitle kicker="Two axes" title="Suite layout" />
      <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
        Organized by <b className="text-ink">domain</b> (data / backend / frontend / scenarios)
        crossed with <b className="text-ink">execution</b> —{" "}
        <span className="text-green">pure</span> (no keys, always green) vs{" "}
        <span className="text-blue">live</span> (needs DB/HubSpot/Stripe, skips gracefully). The
        no-keys CI gate is the union of pure files: <code className="mono rounded bg-fill px-1.5 py-0.5 text-slate">npm run test:ci</code>.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {SUITES.map((s) => (
          <div key={s.id} className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-ink">{s.label}</h3>
              <code className="mono text-[10px] text-blue">{s.script}</code>
            </div>
            <p className="mt-1 text-[12px] text-muted">{s.domain}</p>
            <div className="mt-3 space-y-1.5">
              {s.files.length === 0 ? (
                <p className="text-[12px] italic text-label">No tests yet — add component/page tests here.</p>
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

      {/* ---- phases ---- */}
      {groups.map((g) => (
        <section key={g.phase}>
          <SectionTitle kicker={`${g.items.length} use cases`} title={g.phase} />
          <div className="mt-5 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
            {g.items.map((uc) => (
              <UseCaseRow key={uc.id} uc={uc} run={results?.byId[uc.id]} />
            ))}
          </div>
        </section>
      ))}

      {/* ---- how to run ---- */}
      <SectionTitle kicker="Reproducible" title="Run the suite" />
      <div className="mt-5 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
        {[
          ["npm test", "Run the whole suite (live cases skip without keys)."],
          ["npx vitest run tests/brief-usecases.test.ts", "Just the brief use cases (pure, always green)."],
          ["npm run test:report", "Write seed-data/test-results.json to light up this page."],
          ["npm run verify", "build + lint + test:ci — the reproducible pre-submission gate."],
        ].map(([cmd, what]) => (
          <div key={cmd} className="flex flex-col gap-1 border-b border-hairline px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
            <code className="mono shrink-0 text-[12px] text-ink sm:w-[380px]">{cmd}</code>
            <span className="text-[12px] text-muted">{what}</span>
          </div>
        ))}
      </div>

      <footer className="mt-12 border-t border-hairline pt-5 text-[12px] text-label">
        Catalog: <span className="mono">lib/dev/usecases.ts</span> · Runnable proofs:{" "}
        <span className="mono">tests/brief-usecases.test.ts</span> · Requirements:{" "}
        <span className="mono">docs/01-intake/REQUIREMENTS.md</span> ·{" "}
        <Link href="/dev" className="text-blue hover:underline">data overview →</Link>
      </footer>
    </div>
  );
}
