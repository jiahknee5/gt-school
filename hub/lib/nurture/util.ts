// Deterministic per-record hashing so the nurture stand-ins (engagement, SLA contact,
// SMS threads) are byte-identical across runs without seeding new DB tables. Same id →
// same value, always. This is the pure twin of the HubSpot/Conversations connectors the
// live build would read; it never depends on funnel_stage/enrollments (no circularity).

export function hash01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // map to [0,1)
  return (h >>> 0) / 4294967296;
}

/** Wilson 95% confidence half-width for a proportion (honest small-cell encoding). */
export function wilsonHalfWidth(successes: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return Number((margin * 100).toFixed(1));
}
