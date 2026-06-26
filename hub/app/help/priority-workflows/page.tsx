import Link from "next/link";

export const metadata = {
  title: "Priority workflows - GT Marketing Hub",
};

type WorkflowTone = "blue" | "green" | "violet" | "amber" | "neutral";

interface Workflow {
  priority: number;
  title: string;
  shortName: string;
  tone: WorkflowTone;
  graderProof: string;
  businessValue: string;
  technicalValue: string;
  modules: string[];
  data: string[];
  tech: string[];
  flow: string[];
}

const TONE: Record<WorkflowTone, { pill: string; rail: string; node: string }> = {
  blue: {
    pill: "bg-fill text-slate",
    rail: "border-gold",
    node: "bg-fill text-slate",
  },
  green: {
    pill: "bg-fill text-slate",
    rail: "border-gold",
    node: "bg-fill text-slate",
  },
  violet: {
    pill: "bg-fill text-slate",
    rail: "border-gold",
    node: "bg-fill text-slate",
  },
  amber: {
    pill: "bg-fill text-slate",
    rail: "border-gold",
    node: "bg-fill text-slate",
  },
  neutral: {
    pill: "bg-fill text-slate",
    rail: "border-hairline",
    node: "bg-fill text-slate",
  },
};

const WORKFLOWS: Workflow[] = [
  {
    priority: 1,
    title: "Budget overrun -> Decision Queue -> Leader ruling",
    shortName: "Budget governance",
    tone: "amber",
    graderProof:
      "Budget reconciles to $365K, variance auto-flags to Decision Queue, non-leaders are blocked, and the ruling has an audit trail.",
    businessValue:
      "Keeps GT from overspending the $365K plan and turns budget exceptions into accountable leadership decisions.",
    technicalValue:
      "Proves canonical money math, role enforcement, cross-module writes, and auditable state transitions.",
    modules: ["Budget", "Decision Queue", "Home preview"],
    data: ["budget_entry", "workstream plans", "variance threshold", "decision records", "user roles"],
    tech: ["Next.js pages", "Supabase RLS/API guards", "server actions/routes", "budget aggregation", "decision mutations"],
    flow: [
      "Owner edits spend",
      "Budget recomputes",
      "$365K total check",
      ">10% variance",
      "DQ item created",
      "Leader rules",
      "Status returns",
    ],
  },
  {
    priority: 2,
    title: "Data-confidence drop -> banner -> CRM Ops drill-in",
    shortName: "Data trust",
    tone: "green",
    graderProof:
      "Sync parity becomes product UX, unreliable fields are labeled honestly, and source-of-truth rules are visible.",
    businessValue:
      "Prevents teams from acting on bad CRM data and makes known data quality gaps visible instead of hidden.",
    technicalValue:
      "Proves sync parity, field-level authority, connector health, and global trust UX over shared data.",
    modules: ["CRM Ops", "Global banner", "Nurture", "Dashboard/KPI"],
    data: ["field_state", "parity_snapshot", "synced contact fields", "connector timestamps", "data-quality issues"],
    tech: ["parity computation", "banner component", "CRM Ops drill-in", "HubSpot reconcile job", "field authority rules"],
    flow: [
      "HubSpot fields",
      "App fields",
      "Field authority",
      "Parity snapshot",
      "Banner appears",
      "CRM Ops drill-in",
      "Quality issue logged",
    ],
  },
  {
    priority: 3,
    title: "Payment/deposit propagation without contamination",
    shortName: "Payment backbone",
    tone: "violet",
    graderProof:
      "Stripe event is idempotent, routes to the correct program store, writes back to CRM, and cannot leak across programs.",
    businessValue:
      "Gives staff confidence that paid families land in the right program and deposits update operating metrics correctly.",
    technicalValue:
      "Proves webhook verification, idempotency, outbox sync, program isolation, and CRM writeback.",
    modules: ["Payment/admin surface", "CRM/HubSpot", "Program store", "Home/Dashboard metric"],
    data: ["Stripe event payloads", "processed event ids", "families", "enrollments", "program-scoped records"],
    tech: ["Stripe webhook verification", "outbox worker", "RLS withProgram", "idempotency keys", "HubSpot writeback"],
    flow: [
      "Stripe webhook",
      "Verify + dedupe",
      "Resolve program",
      "Scoped write",
      "Outbox event",
      "HubSpot update",
      "Deposit metric",
    ],
  },
  {
    priority: 4,
    title: "Open Data-enriched decision",
    shortName: "External evidence",
    tone: "blue",
    graderProof:
      "A real Open Data query changes a decision recommendation and shows a failure or insufficient-data state.",
    businessValue:
      "Helps leadership choose markets, events, or spend using external school-market evidence instead of opinion alone.",
    technicalValue:
      "Proves third-party integration, enrichment persistence, explainable recommendation deltas, and graceful failure.",
    modules: ["Decision Queue", "Open Data enrichment", "Budget/Event context", "Home preview"],
    data: ["decision record", "school/market query params", "Open Data response", "enrichment summary", "fallback state"],
    tech: ["Open Data API route", "enrichment service", "decision-card UI", "cached payloads", "failure handling"],
    flow: [
      "Decision proposal",
      "Run enrichment",
      "Query market data",
      "Evidence attached",
      "Recommendation changes",
      "Leader rules",
      "Outcome returns",
    ],
  },
  {
    priority: 5,
    title: "Monday marketing meeting flow",
    shortName: "Operating cadence",
    tone: "neutral",
    graderProof:
      "The app works as a business operating system: shared scorecard, risks, data confidence, and decisions in one flow.",
    businessValue:
      "Shows GT can run the weekly marketing operating cadence from one product instead of scattered dashboards and docs.",
    technicalValue:
      "Proves role-aware navigation, shared metric semantics, cross-module drill-ins, and responsive product cohesion.",
    modules: ["Home", "Dashboard/KPI", "Budget", "CRM Ops", "Decision Queue"],
    data: ["home layout", "executive narrative", "scorecard KPIs", "budget status", "open decisions"],
    tech: ["Home widgets", "shared metrics layer", "Dashboard scorecard", "role-aware nav", "Help guide"],
    flow: [
      "Leader login",
      "Home narrative",
      "Scorecard scan",
      "Budget red flags",
      "CRM confidence",
      "Decision Queue",
      "Meeting recap",
    ],
  },
];

function ChipList({ items, tint }: { items: string[]; tint: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`mono rounded-[5px] px-1.5 py-0.5 text-[10px] ${tint}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function FlowRail({ workflow }: { workflow: Workflow }) {
  const tone = TONE[workflow.tone];
  return (
    <ol className={`grid gap-2 border-l-2 pl-3 ${tone.rail}`}>
      {workflow.flow.map((step, index) => (
        <li key={step} className="relative">
          <span className={`mono absolute -left-[24px] top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${tone.node}`}>
            {index + 1}
          </span>
          <div className="rounded-card border border-hairline bg-canvas px-3 py-2 text-[12px] font-semibold leading-snug text-ink">
            {step}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-canvas p-3">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">{label}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{value}</p>
    </div>
  );
}

export default function PriorityWorkflowsPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-7 lg:px-9">
      <Link href="/help" className="mono text-[11px] text-blue hover:underline">
        &lt;- All guides
      </Link>

      <p className="mono mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        Help / Priority workflows
      </p>
      <h1 className="mt-2 max-w-[920px] font-serif text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
        Side-by-side workflow map for the grader demo
      </h1>
      <p className="mt-3 max-w-[840px] text-[15px] leading-relaxed text-muted">
        These are the five highest-leverage use cases to build and narrate. Each one shows
        the workflow, business value, technical value, modules, data, and implementation
        pieces needed to make the demo credible.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-5">
        {[
          ["Workflows", `${WORKFLOWS.length}`],
          ["Build first", "1-3"],
          ["Core modules", "4"],
          ["Demo path", "5-10m"],
          ["Value lens", "Biz + tech"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <div className="mono text-[11px] uppercase tracking-[0.1em] text-label">{label}</div>
            <div className="num mt-1 font-serif text-[24px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <section className="mt-9 overflow-x-auto rounded-card border border-hairline bg-surface shadow-sm">
        <table className="min-w-[1120px] border-collapse text-left text-[12px]">
          <thead className="border-b border-hairline bg-fill text-ink">
            <tr>
              {["#", "Workflow", "Business value", "Technical value", "Modules", "Data", "Tech"].map((head) => (
                <th key={head} className="px-3 py-3 mono text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WORKFLOWS.map((workflow) => (
              <tr key={workflow.priority} className="border-b border-hairline last:border-0">
                <td className="px-3 py-3 align-top">
                  <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold ${TONE[workflow.tone].pill}`}>
                    P{workflow.priority}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <p className="font-semibold leading-snug text-ink">{workflow.shortName}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted">{workflow.title}</p>
                </td>
                <td className="max-w-[220px] px-3 py-3 align-top leading-relaxed text-muted">{workflow.businessValue}</td>
                <td className="max-w-[220px] px-3 py-3 align-top leading-relaxed text-muted">{workflow.technicalValue}</td>
                <td className="px-3 py-3 align-top">
                  <ChipList items={workflow.modules} tint="border border-hairline bg-fill text-slate" />
                </td>
                <td className="px-3 py-3 align-top">
                  <ChipList items={workflow.data} tint="border border-hairline bg-fill text-slate" />
                </td>
                <td className="px-3 py-3 align-top">
                  <ChipList items={workflow.tech} tint="border border-hairline bg-fill text-slate" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
              Workflow cards
            </p>
            <h2 className="mt-1 font-serif text-[24px] font-bold tracking-[-0.01em] text-ink">
              What each use case needs
            </h2>
          </div>
          <p className="max-w-[480px] text-[12px] leading-relaxed text-muted">
            Read left to right inside each card. The rail is the demo path; the right side is
            the value and implementation checklist.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {WORKFLOWS.map((workflow) => (
            <article key={workflow.priority} className="rounded-card border border-hairline bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className={`mono rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${TONE[workflow.tone].pill}`}>
                    Priority {workflow.priority}
                  </span>
                  <h3 className="mt-2 font-serif text-[21px] font-bold leading-tight tracking-[-0.01em] text-ink">
                    {workflow.title}
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <p className="mono mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-label">
                    HTML workflow diagram
                  </p>
                  <FlowRail workflow={workflow} />
                </div>

                <div className="space-y-3">
                  <ValueBlock label="Grader proof" value={workflow.graderProof} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ValueBlock label="Business value" value={workflow.businessValue} />
                    <ValueBlock label="Technical value" value={workflow.technicalValue} />
                  </div>
                  <div className="rounded-card border border-hairline bg-canvas p-3">
                    <p className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-label">Modules</p>
                    <div className="mt-2">
                      <ChipList items={workflow.modules} tint="border border-hairline bg-fill text-slate" />
                    </div>
                    <p className="mono mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-label">Data</p>
                    <div className="mt-2">
                      <ChipList items={workflow.data} tint="border border-hairline bg-fill text-slate" />
                    </div>
                    <p className="mono mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-label">Tech</p>
                    <div className="mt-2">
                      <ChipList items={workflow.tech} tint="border border-hairline bg-fill text-slate" />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-card border border-hairline bg-surface p-5 shadow-sm">
        <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          Implementation cut line
        </p>
        <p className="mt-2 max-w-[920px] text-[14px] leading-relaxed text-muted">
          Build workflows 1-3 before expanding surface area. They prove the backbone,
          source-of-truth discipline, role gates, and visible cross-module handoffs. Add
          Open Data as a focused enhancement to Decision Queue, then use the Monday meeting
          flow to stitch the demo narrative together.
        </p>
      </section>

      <footer className="mt-12 border-t border-hairline pt-5 text-[12px] text-label">
        Source doc: <span className="mono">docs/use-cases/PRIORITY-WORKFLOWS.md</span> /{" "}
        <Link href="/help/roadmap" className="text-blue hover:underline">
          build roadmap
        </Link>{" "}
        /{" "}
        <Link href="/help" className="text-blue hover:underline">
          all guides
        </Link>
      </footer>
    </div>
  );
}
