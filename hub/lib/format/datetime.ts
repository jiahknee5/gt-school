// The single source of truth for date/time display across the Hub. GT operates in
// Austin, so every rendered timestamp is Central Time (America/Chicago, CST/CDT) — not
// the server's UTC. Before this, date formatting was re-implemented ~5 times (some UTC,
// some Central, all disagreeing on shape) and many surfaces did `iso.slice(0,10)` which
// is a silent UTC truncation that lands a day early near Central midnight.
//
// Use ctDate() for date-only, ctDateTime() for date+time (both stamp the CST/CDT zone).

const CENTRAL = "America/Chicago";

function parse(value: string | number | Date | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** "Jun 28, 2026" in Central Time. */
export function ctDate(value: string | number | Date | null | undefined, fallback = "—"): string {
  const t = parse(value);
  if (t == null) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: CENTRAL,
  }).format(t);
}

/** "Jun 28, 2026, 9:54 PM CDT" in Central Time (zone label included). */
export function ctDateTime(value: string | number | Date | null | undefined, fallback = "—"): string {
  const t = parse(value);
  if (t == null) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: CENTRAL,
    timeZoneName: "short",
  }).format(t);
}

/** Compact "Jun 28, 9:54 PM CDT" — for dense tables (no year/seconds). */
export function ctDateTimeShort(value: string | number | Date | null | undefined, fallback = "—"): string {
  const t = parse(value);
  if (t == null) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: CENTRAL,
    timeZoneName: "short",
  }).format(t);
}
