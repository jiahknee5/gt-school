// Module 7 — CRM / Marketing Operations. The data-infrastructure health surface: it is
// the only module that MEASURES its sources (Supabase app_form ↔ HubSpot) rather than
// reporting from them. Five sub-views (Overview · Source tracking · Lead scoring ·
// Sync parity · Data quality), the owned data-confidence banner, and an idempotent
// auto-detector.
//
// RBAC: Admin (Marketing Lead) + Leader read; Operators are denied (PRD §3 Module 7).
// The denial is enforced SERVER-SIDE here from the authenticated session — not UI-only.
//
// Data: this surface renders from the deterministic seed snapshot (the whole Hub does,
// so build/test need no DB), but every number runs through the SAME pure parity/detect/
// queue logic the live engine uses. Stand-in vs live is labeled honestly below.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { DEMO_USERS } from "@/lib/phase2";
import { DEV_MODE, getSession } from "@/lib/auth";
import { parityThreshold } from "@/lib/parity";
import { computeSeedParity, seedBannerState } from "@/lib/crm-ops/parity-view";
import { summarizeAttribution } from "@/lib/crm-ops/attribution";
import { summarizeLeadScores } from "@/lib/crm-ops/scoring";
import { runDetect } from "@/lib/crm-ops/detect";
import { buildQueue, canViewCrmOps } from "@/lib/crm-ops/queue";
import { DataConfidenceBanner } from "@/app/_components/DataConfidenceBanner";
import { ParityScore } from "./_components/ParityScore";
import { FieldParityTable } from "./_components/FieldParityTable";
import { ReliabilityFlags } from "./_components/ReliabilityFlags";
import { AttributionChain } from "./_components/AttributionChain";
import { BrokenUtmDrill } from "./_components/BrokenUtmDrill";
import { ScoreHistogram } from "./_components/ScoreHistogram";
import { DqQueue } from "./_components/DqQueue";
import { SotReminder } from "./_components/SotReminder";
import { MetricTile } from "./_components/primitives";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "CRM / Marketing Operations | GT Marketing Hub",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "source", label: "Source tracking" },
  { key: "scoring", label: "Lead scoring" },
  { key: "parity", label: "Sync parity" },
  { key: "quality", label: "Data quality" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabHref(tab: TabKey): string {
  return tab === "overview" ? "/m/crm-ops" : `/m/crm-ops?tab=${tab}`;
}

function loginHref(role: string) {
  return `/api/auth/login?role=${role}&next=${encodeURIComponent("/m/crm-ops")}`;
}

export default async function CrmOpsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; role?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  // Role is authoritative from the session; the ?role= lens is a dev fallback only.
  const role = session?.role ?? (query.role as "admin" | "leader" | "operator" | undefined);
  const activeTab: TabKey =
    TABS.find((t) => t.key === query.tab)?.key ?? "overview";

  const allowed = canViewCrmOps(role);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-7 lg:px-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="mono text-[11px] font-semibold text-gold hover:underline">
                Home
              </Link>
              <p className="mono mt-4 text-[11px] font-semibold text-label">Module 7</p>
              <h1 className="mt-1 font-serif text-[34px] font-semibold leading-tight text-ink">
                CRM / Marketing Operations
              </h1>
              <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-muted">
                Data-infrastructure health: Supabase app_form to HubSpot sync parity, UTM attribution
                health, read-only lead scoring, and an auto-detecting data-quality queue. This module owns
                the data-confidence banner every HubSpot-consuming module reads.
              </p>
            </div>

            <div className="rounded-card border border-hairline bg-canvas p-3">
              <p className="mono text-[11px] font-semibold text-label">
                {DEV_MODE ? "Role lens (dev switcher)" : "Active role"}
              </p>
              {DEV_MODE && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DEMO_USERS.map((user) => (
                    <a
                      key={user.id}
                      href={loginHref(user.role)}
                      className={`rounded-card border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                        role === user.role
                          ? "border-gold bg-amber-soft text-ink"
                          : "border-hairline bg-surface text-muted hover:border-border hover:text-ink"
                      }`}
                    >
                      {user.role}
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[12px] text-muted">
                Admin + Leader read · Operators denied
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-5 py-6 sm:px-7 lg:px-9">
        {!allowed ? (
          <AccessDenied role={role} />
        ) : (
          <CrmOpsBody activeTab={activeTab} role={role ?? "leader"} />
        )}
      </div>
    </main>
  );
}

function AccessDenied({ role }: { role: string | undefined }) {
  return (
    <section className="rounded-card border border-red-soft bg-red-soft p-5 text-red">
      <p className="text-[15px] font-semibold">Access denied for this role</p>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed">
        CRM / Marketing Operations is restricted to Admin (Marketing Lead) and Leadership. The current
        role{role ? ` (${role})` : ""} cannot view sync parity, lead scoring, or the data-quality queue.
        This check runs server-side from the authenticated session.
      </p>
    </section>
  );
}

function CrmOpsBody({ activeTab, role }: { activeTab: TabKey; role: "admin" | "leader" | "operator" }) {
  const ds = generate({ seed: 424242, families: 1200 });
  const thresholdPct = Number((parityThreshold() * 100).toFixed(2));

  const parity = computeSeedParity(ds.field_state);
  const banner = seedBannerState(ds.field_state, thresholdPct);
  const attribution = summarizeAttribution(ds.families);
  const scoring = summarizeLeadScores(ds.families);
  const detect = runDetect(ds, ds.data_quality_issue, thresholdPct);
  const queue = buildQueue(ds.data_quality_issue, detect.plan.desired);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        {/* The owned data-confidence banner, rendered on its own home too. */}
        <DataConfidenceBanner state={banner} />

        {/* Sub-view tab bar */}
        <nav className="flex flex-wrap gap-1.5 rounded-card border border-hairline bg-surface p-1.5">
          {TABS.map((t) => {
            const active = t.key === activeTab;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                aria-current={active ? "page" : undefined}
                className={`rounded-card px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  active ? "bg-ink-cta text-on-cta shadow-sm" : "text-muted hover:bg-hover hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {activeTab === "overview" && (
          <OverviewView
            parity={parity}
            thresholdPct={thresholdPct}
            attribution={attribution}
            scoring={scoring}
            openIssues={queue.openCount}
            detectByCategory={detect.byCategory}
          />
        )}
        {activeTab === "source" && (
          <div className="space-y-5">
            <AttributionChain attribution={attribution} />
            <BrokenUtmDrill attribution={attribution} />
          </div>
        )}
        {activeTab === "scoring" && <ScoreHistogram scoring={scoring} />}
        {activeTab === "parity" && (
          <div className="space-y-5">
            <SotReminder />
            <ParityScore parity={parity} thresholdPct={thresholdPct} />
            <FieldParityTable fieldDetail={parity.fieldDetail} thresholdPct={thresholdPct} />
            <ReliabilityFlags fieldDetail={parity.fieldDetail} />
          </div>
        )}
        {activeTab === "quality" && <DqQueue queue={queue} role={role} />}
      </div>

      <aside className="space-y-4">
        <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
          <h2 className="font-serif text-[18px] font-semibold text-ink">Auto-detector</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Runs after reconcile; idempotent by (category, entity, entity_id, field). This pass would
            open <span className="font-semibold text-ink">{detect.openedCount}</span> and resolve{" "}
            <span className="font-semibold text-ink">{detect.resolvedCount}</span> issue(s).
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(detect.byCategory).map(([cat, n]) => (
              <span key={cat} className="mono rounded-card border border-border bg-canvas px-2 py-1 text-[11px] font-semibold text-ink">
                {cat}: {n}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
          <h2 className="font-serif text-[18px] font-semibold text-ink">Source notes</h2>
          <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted">
            <li>Supabase app_form is authoritative for funnel, TEFA, income, grade.</li>
            <li>HubSpot is authoritative for lifecycle, lead score, source.</li>
            <li>Lead scoring is read-only — the Hub never writes scores back.</li>
            <li>
              Rendered from the deterministic seed snapshot through the same pure parity/detect/queue
              logic the live engine uses.
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function OverviewView({
  parity,
  thresholdPct,
  attribution,
  scoring,
  openIssues,
  detectByCategory,
}: {
  parity: ReturnType<typeof computeSeedParity>;
  thresholdPct: number;
  attribution: ReturnType<typeof summarizeAttribution>;
  scoring: ReturnType<typeof summarizeLeadScores>;
  openIssues: number;
  detectByCategory: Record<string, number>;
}) {
  const worst = parity.fieldDetail[0];
  return (
    <div className="space-y-5">
      {/* Overall AND worst field together — anti-vanity. */}
      <ParityScore parity={parity} thresholdPct={thresholdPct} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          label="UTM health"
          value={`${attribution.health.healthPct}%`}
          note={`${attribution.health.broken} broken of ${attribution.health.total} — attribution is a pinned red flag until rebuilt.`}
          tone="risk"
        />
        <MetricTile
          label="Open issues"
          value={String(openIssues)}
          note={`Auto-detected + manual. ${Object.entries(detectByCategory)
            .map(([c, n]) => `${c}:${n}`)
            .join(" · ")}`}
          tone={openIssues ? "watch" : "good"}
        />
        <MetricTile
          label="Lead scoring"
          value={`${scoring.scored}/${scoring.scored + scoring.unscored}`}
          note={`Scored families (read-only). ${scoring.unscored} missing a score.`}
          tone="neutral"
        />
      </div>

      {worst && worst.pct < thresholdPct && (
        <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
          <p className="text-[13px] leading-relaxed text-ink">
            <span className="font-semibold">Worst field is not hidden:</span>{" "}
            <span className="mono">{worst.field}</span> is at {worst.pct}% (
            {worst.expectedUnreliable ? "known-unreliable, calm" : "surprise drift"}). Open the{" "}
            <Link href={tabHref("parity")} className="font-semibold text-gold hover:underline">
              Sync parity
            </Link>{" "}
            tab to drill in, or the{" "}
            <Link href={tabHref("quality")} className="font-semibold text-gold hover:underline">
              Data quality
            </Link>{" "}
            queue to act.
          </p>
        </section>
      )}
    </div>
  );
}
