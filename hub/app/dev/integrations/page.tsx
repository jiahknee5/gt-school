import Link from "next/link";
import { DevTabs } from "../_components/DevTabs";
import {
  integrationCoverage,
  missingRequiredIntegrations,
  PRD_REQUIRED_INTEGRATION_IDS,
} from "@/lib/integrations/catalog";
import { humanizeAge } from "@/lib/dashboard/freshness";
import { generate } from "@/lib/seed/generate";
import type {
  IntegrationAccount,
  IntegrationStatus,
  IntegrationSyncRun,
} from "@/lib/seed/types";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<IntegrationStatus, string> = {
  connected: "bg-green-soft text-green",
  standin: "bg-amber-soft text-amber",
  degraded: "bg-red-soft text-red",
  manual: "bg-violet-soft text-violet",
  deferred: "bg-fill text-label",
};

const RUN_TINT: Record<IntegrationSyncRun["status"], string> = {
  success: "bg-green-soft text-green",
  warning: "bg-amber-soft text-amber",
  failed: "bg-red-soft text-red",
  skipped: "bg-fill text-label",
};

function StatusBadge({ status }: { status: IntegrationStatus }) {
  return (
    <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${STATUS_TINT[status]}`}>
      {status === "standin" ? "stand-in" : status}
    </span>
  );
}

function RunBadge({ status }: { status: IntegrationSyncRun["status"] }) {
  return (
    <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${RUN_TINT[status]}`}>
      {status}
    </span>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mt-6">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">{kicker}</p>
      <h2 className="mt-0.5 font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
    </div>
  );
}

function lastRunText(run?: IntegrationSyncRun): string {
  if (!run) return "no run";
  if (run.completed_at === null) return "skipped";
  return humanizeAge(run.lag_minutes);
}

function SourceCard({ account, run }: { account: IntegrationAccount; run?: IntegrationSyncRun }) {
  return (
    <article className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold text-ink">{account.display_name}</h3>
          <p className="mono mt-0.5 text-[10px] text-label">{account.system}</p>
        </div>
        <StatusBadge status={account.status} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">{account.business_purpose}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate">{account.why_important}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-hairline pt-2 text-[10px]">
        <div>
          <p className="mono uppercase tracking-[0.08em] text-label">Owner</p>
          <p className="truncate text-slate">{account.owner_role}</p>
        </div>
        <div>
          <p className="mono uppercase tracking-[0.08em] text-label">Rows</p>
          <p className="num text-slate">{account.row_count.toLocaleString()}</p>
        </div>
        <div>
          <p className="mono uppercase tracking-[0.08em] text-label">Mode</p>
          <p className="text-slate">{account.synthetic_mode}</p>
        </div>
        <div>
          <p className="mono uppercase tracking-[0.08em] text-label">Last run</p>
          <p className="text-slate">{lastRunText(run)}</p>
        </div>
      </div>
    </article>
  );
}

export default function DevIntegrationsPage() {
  const ds = generate({ seed: 424242, families: 1200 });
  const accounts = ds.integration_accounts;
  const runs = ds.integration_sync_runs;
  const coverage = integrationCoverage(accounts);
  const missing = missingRequiredIntegrations(accounts);
  const runsById = new Map(runs.map((run) => [run.integration_id, run]));
  const sourceCards = accounts.filter((row) =>
    ["supabase_app_form", "hubspot_crm", "stripe", "ga4_anywhere", "gt_challenge_capture", "read_ai_transcripts"].includes(row.integration_id),
  );
  const gapRows = accounts.filter((row) => row.known_gaps.length > 0);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Admin
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Integrations
      </h1>
      <p className="mt-1.5 max-w-[780px] text-[12px] leading-snug text-muted">
        Admin registry for the Hub&apos;s PRD data sources: connected services, fixture-backed
        connectors, manual-v1 channels, known degraded sources, and deferred integrations. Every
        row is tied to a business owner, authoritative fields, join keys, and a recent sync run.
      </p>

      <DevTabs />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Sources", `${coverage.total}`],
          ["Represented", `${coverage.represented}`],
          ["Connected", `${coverage.connected}`],
          ["Degraded", `${coverage.degraded}`],
          ["Deferred", `${coverage.deferred}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-0.5 font-serif text-[18px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-card border border-hairline bg-surface px-3 py-2 text-[11px]">
        {missing.length === 0 ? (
          <p className="text-green">
            <b>{PRD_REQUIRED_INTEGRATION_IDS.length}/{PRD_REQUIRED_INTEGRATION_IDS.length}</b>{" "}
            required PRD and inferred operational sources are represented.
          </p>
        ) : (
          <p className="text-red">Missing sources: {missing.join(", ")}</p>
        )}
      </div>

      <SectionTitle kicker="Configured sources" title="Source cards" />
      <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {sourceCards.map((account) => (
          <SourceCard
            key={account.integration_id}
            account={account}
            run={runsById.get(account.integration_id)}
          />
        ))}
      </div>

      <SectionTitle kicker={`${accounts.length} integrations`} title="Integration inventory" />
      <div className="mt-2.5 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
        <table className="w-full min-w-[1320px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-side">
              {["System", "Status", "Mode", "Owner", "Rows", "Freshness", "Source owns", "Join keys", "Modules", "Why it matters"].map((h) => (
                <th key={h} className="mono px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-label">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const run = runsById.get(account.integration_id);
              return (
                <tr key={account.integration_id} className="border-b border-hairline last:border-0 align-top">
                  <td className="px-2 py-1.5">
                    <p className="text-[11px] font-semibold text-ink">{account.display_name}</p>
                    <p className="mono text-[9px] text-label">{account.system}</p>
                  </td>
                  <td className="px-2 py-1.5"><StatusBadge status={account.status} /></td>
                  <td className="px-2 py-1.5">
                    <p className="mono text-[10px] text-slate">{account.connector_kind}</p>
                    <p className="mono text-[9px] text-label">{account.synthetic_mode}</p>
                  </td>
                  <td className="px-2 py-1.5 text-[10px] text-muted">{account.owner_role}</td>
                  <td className="num px-2 py-1.5 text-[10px] text-slate">{account.row_count.toLocaleString()}</td>
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] text-slate">{lastRunText(run)}</p>
                    <p className="mono text-[9px] text-label">
                      {account.freshness_sla_minutes === null ? "SLA n/a" : `SLA ${account.freshness_sla_minutes}m`}
                    </p>
                  </td>
                  <td className="max-w-[190px] px-2 py-1.5 text-[10px] leading-snug text-muted">
                    {account.authoritative_for.length ? account.authoritative_for.join(", ") : "none yet"}
                  </td>
                  <td className="max-w-[180px] px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {account.join_keys.map((key) => (
                        <code key={key} className="mono rounded-[4px] bg-canvas px-1 py-0.5 text-[9px] text-blue">{key}</code>
                      ))}
                    </div>
                  </td>
                  <td className="max-w-[190px] px-2 py-1.5 text-[10px] leading-snug text-muted">
                    {account.module_slugs.join(", ")}
                  </td>
                  <td className="max-w-[300px] px-2 py-1.5 text-[10px] leading-snug text-slate">{account.why_important}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionTitle kicker={`${runs.length} runs`} title="Recent sync activity" />
      <div className="mt-2.5 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-side">
              {["Integration", "Run", "Started", "Completed", "Read", "Wrote", "Errored", "Notes"].map((h) => (
                <th key={h} className="mono px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-label">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const account = byId(accounts, run.integration_id);
              return (
                <tr key={run.run_id} className="border-b border-hairline last:border-0 align-top">
                  <td className="px-2 py-1.5">
                    <p className="text-[11px] font-semibold text-ink">{account?.display_name ?? run.integration_id}</p>
                    <p className="mono text-[9px] text-label">{run.run_id}</p>
                  </td>
                  <td className="px-2 py-1.5"><RunBadge status={run.status} /></td>
                  <td className="mono px-2 py-1.5 text-[10px] text-muted">{run.started_at.slice(0, 16).replace("T", " ")}</td>
                  <td className="mono px-2 py-1.5 text-[10px] text-muted">{run.completed_at ? run.completed_at.slice(0, 16).replace("T", " ") : "skipped"}</td>
                  <td className="num px-2 py-1.5 text-[10px] text-slate">{run.records_read.toLocaleString()}</td>
                  <td className="num px-2 py-1.5 text-[10px] text-slate">{run.records_written.toLocaleString()}</td>
                  <td className="num px-2 py-1.5 text-[10px] text-slate">{run.records_errored.toLocaleString()}</td>
                  <td className="max-w-[360px] px-2 py-1.5 text-[10px] leading-snug text-muted">{run.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionTitle kicker={`${gapRows.length} visible`} title="Known gaps" />
      <div className="mt-2.5 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
        {gapRows.map((account) => (
          <div key={account.integration_id} className="border-b border-hairline px-3 py-2 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold text-ink">{account.display_name}</p>
              <StatusBadge status={account.status} />
              <span className="mono rounded-[5px] bg-fill px-1.5 py-0.5 text-[9px] text-label">{account.owner_role}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {account.known_gaps.map((gap) => (
                <li key={gap} className="text-[11px] leading-snug text-muted">{gap}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="mt-6 border-t border-hairline pt-3 text-[11px] text-label">
        Registry source: <span className="mono">lib/integrations/catalog.ts</span> · Fixture tables:{" "}
        <span className="mono">integration_accounts</span>, <span className="mono">integration_sync_runs</span> ·{" "}
        <Link href="/dev/dictionary#integration_accounts" className="text-blue hover:underline">data dictionary</Link>
      </footer>
    </div>
  );
}

function byId(accounts: IntegrationAccount[], integrationId: string): IntegrationAccount | undefined {
  return accounts.find((account) => account.integration_id === integrationId);
}
