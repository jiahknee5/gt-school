import type { FunnelStep } from "@/lib/status/board";

export function FunnelMini({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="flex flex-col gap-0.5">
      {steps.map((step, i) => (
        <div key={step.label}>
          <div className="grid grid-cols-[60px_1fr_32px] items-center gap-1.5">
            <span className="text-[10px] text-muted">{step.label}</span>
            <span className="h-1.5 rounded-sm bg-slate" style={{ width: `${Math.round((step.value / max) * 100)}%`, maxWidth: "100%" }} />
            <span className="mono text-right text-[10px] font-bold text-ink">{step.value.toLocaleString()}</span>
          </div>
          {step.dropPct != null && i < steps.length - 1 && (
            <p className="mono pl-[66px] text-[9px] text-muted">▼ {step.dropPct}% drop</p>
          )}
        </div>
      ))}
    </div>
  );
}
