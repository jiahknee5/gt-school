// Data-quality queue — open issues by severity + a resolution log. Auto-detected items
// are tagged; an owner is shown (derived, not stored). Ack/prioritize/resolve actions
// are shown only to roles allowed to act (Admin/Leader); descriptions carry no PII.

import type { QueueView } from "@/lib/crm-ops/queue";
import type { Role } from "@/lib/phase2";
import { canActOnQueue } from "@/lib/crm-ops/queue";
import { ctDate } from "@/lib/format/datetime";
import { Card, Pill, type Tone } from "./primitives";

function sevTone(severity: string): Tone {
  if (severity === "blocker" || severity === "high") return "risk";
  if (severity === "medium") return "watch";
  return "neutral";
}

export function DqQueue({ queue, role }: { queue: QueueView; role: Role | null | undefined }) {
  const canAct = canActOnQueue(role);
  return (
    <div className="space-y-3">
      <Card
        title="Open data-quality issues"
        note="Auto-detected drift + UTM breakage and manual/system issues, by severity."
        right={<Pill tone={queue.openCount ? "watch" : "good"}>{queue.openCount} open</Pill>}
      >
        {queue.open.length === 0 ? (
          <p className="py-4 text-[11px] text-muted">No open issues — the queue is clear.</p>
        ) : (
          <div className="divide-y divide-hairline">
            {queue.open.map((i) => (
              <div key={i.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_220px] sm:items-start">
                <div>
                  <p className="text-[13px] font-semibold leading-snug text-ink">{i.description}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    {i.category} · owner {i.owner} · {i.autoDetected ? "auto-detected" : "manual/system"}
                  </p>
                  {canAct && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(["Acknowledge", "Prioritize", "Resolve"] as const).map((a) => (
                        <span
                          key={a}
                          className="rounded-card border border-border bg-canvas px-2 py-1 text-[11px] font-semibold text-ink"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Pill tone={sevTone(i.severity)}>{i.severity}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Resolution log" note="Issues already resolved (the tamper-aware trail).">
        {queue.resolved.length === 0 ? (
          <p className="py-4 text-[11px] text-muted">No resolved issues yet.</p>
        ) : (
          <div className="divide-y divide-hairline">
            {queue.resolved.map((i) => (
              <div key={i.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_120px] sm:items-center">
                <div>
                  <p className="text-[13px] font-semibold leading-snug text-ink">{i.description}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    {i.category} · resolved {ctDate(i.resolved_at)}
                  </p>
                </div>
                <Pill tone="good">resolved</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
