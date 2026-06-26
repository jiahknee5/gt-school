/**
 * Deterministic, seedable PRNG so the whole dataset is reproducible: the same
 * seed always yields byte-identical fixtures ("reset to a clean known state").
 * mulberry32 — small, fast, good enough for fixtures (NOT cryptographic).
 *
 * Erasable-TS only (no enums) so `node scripts/seed.ts` can run it via type
 * stripping and esbuild can bundle it.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability p. */
  bool(p: number): boolean;
  /** Uniform pick. */
  pick<T>(arr: readonly T[]): T;
  /** Weighted pick: entries of [value, weight]. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T;
  /** Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(arr: readonly T[]): T[];
  /** Deterministic uuid-v4-shaped string. */
  uuid(): string;
  /** A string of n decimal digits. */
  digits(n: number): string;
  /** Gaussian-ish value via central limit, clamped to [min, max]. */
  normalInt(min: number, max: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number =>
    Math.floor(next() * (max - min + 1)) + min;

  const bool = (p: number): boolean => next() < p;

  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];

  const weighted = <T>(entries: ReadonlyArray<readonly [T, number]>): T => {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = next() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r <= 0) return value;
    }
    return entries[entries.length - 1][0];
  };

  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const hex = (n: number): string => {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(next() * 16).toString(16);
    return s;
  };

  const uuid = (): string =>
    `${hex(8)}-${hex(4)}-4${hex(3)}-${((8 + Math.floor(next() * 4)) & 0xf).toString(16)}${hex(3)}-${hex(12)}`;

  const digits = (n: number): string => {
    let s = "";
    for (let i = 0; i < n; i++) s += int(0, 9).toString();
    return s;
  };

  const normalInt = (min: number, max: number): number => {
    const avg = (next() + next() + next()) / 3; // central-limit → bell around 0.5
    return Math.min(max, Math.max(min, Math.round(min + avg * (max - min))));
  };

  return { next, int, bool, pick, weighted, shuffle, uuid, digits, normalInt };
}
