import type { RagStatus } from "@/lib/status/board";

const CONFIG: Record<RagStatus, { shape: string; label: string; className: string }> = {
  green: { shape: "●", label: "On pace", className: "text-green" },
  amber: { shape: "◑", label: "Watch", className: "text-amber" },
  red: { shape: "▲", label: "At risk", className: "text-red" },
};

export function RagToken({ status, compact: compactMode }: { status: RagStatus; compact?: boolean }) {
  const c = CONFIG[status];
  return (
    <span className={`mono inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${c.className}`}>
      <span aria-hidden="true">{c.shape}</span>
      {!compactMode && <span>{c.label}</span>}
    </span>
  );
}
