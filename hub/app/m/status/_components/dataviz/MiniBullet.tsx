/**
 * MiniBullet — the smallest "where vs goal" encoding: a thin progress bar with a
 * target tick at 100%. Decorative only (aria-hidden); the cell pairs it with a
 * text label (now/target or % to goal) so it is color-blind-safe (shape + text).
 * Gold is reserved for the north-star hero gap, so this uses ink/slate (+ red
 * only when behind pace).
 */
export function MiniBullet({ pct, tone }: { pct: number; tone?: "good" | "bad" | "neutral" }) {
  const fill = Math.max(0, Math.min(100, pct));
  const barColor = tone === "bad" ? "bg-red" : tone === "good" ? "bg-green" : "bg-slate";
  return (
    <span
      className="relative inline-block h-[3px] w-12 shrink-0 rounded-full bg-fill align-middle"
      aria-hidden="true"
    >
      <span className={`absolute left-0 top-0 h-full rounded-full ${barColor}`} style={{ width: `${fill}%` }} />
      <span className="absolute right-0 top-[-1px] h-[5px] w-px bg-ink/70" />
    </span>
  );
}
