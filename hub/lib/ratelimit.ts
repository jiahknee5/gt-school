// Dependency-free, in-memory fixed-window rate limiter (security finding S7-c).
//
// The GT Challenge capture endpoint (`/api/gifted-quiz`) is PUBLIC and unauthenticated
// — a parent on a paid-social ad posts to it with no session. Without a throttle that
// is an open door for submission floods / cost-inflation of the (future) AI grader and
// the outbound HubSpot sync. This limiter caps requests per client per window and is the
// app-layer floor; a deploy behind a CDN/WAF should add a network-layer limit on top.
//
// In-memory is intentional for this build (single Node server, deterministic tests). A
// horizontally-scaled deploy must swap the store for a shared one (e.g. Redis/Upstash)
// behind the same interface — keep `RateLimiter.check` as the seam.

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Remaining requests in the current window (never negative). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds to wait before retrying; 0 when allowed. */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Max requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly windows = new Map<string, WindowState>();

  constructor(options: RateLimiterOptions) {
    if (options.limit < 1) throw new Error("RateLimiter limit must be >= 1.");
    if (options.windowMs < 1) throw new Error("RateLimiter windowMs must be >= 1.");
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const existing = this.windows.get(key);

    // Start a fresh window if there is none or the prior one has elapsed.
    if (!existing || now >= existing.resetAt) {
      const state: WindowState = { count: 1, resetAt: now + this.windowMs };
      this.windows.set(key, state);
      return {
        allowed: true,
        limit: this.limit,
        remaining: this.limit - 1,
        resetAt: state.resetAt,
        retryAfterSeconds: 0,
      };
    }

    if (existing.count >= this.limit) {
      return {
        allowed: false,
        limit: this.limit,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      limit: this.limit,
      remaining: Math.max(0, this.limit - existing.count),
      resetAt: existing.resetAt,
      retryAfterSeconds: 0,
    };
  }

  /** Drop a single key's window (test/maintenance helper). */
  reset(key?: string): void {
    if (key === undefined) this.windows.clear();
    else this.windows.delete(key);
  }
}

/**
 * Derive a stable client key from a request. Prefers the left-most hop in
 * `x-forwarded-for` (the original client behind a proxy), then `x-real-ip`.
 * Falls back to a shared bucket so a misconfigured proxy fails CLOSED (everyone
 * shares the limit) rather than open (no limit at all).
 */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

// Shared limiter for the public GT Challenge capture endpoint. A real parent
// completes the quiz once (maybe a retry); 10 posts / minute / client is generous
// for a human and still caps an abusive flood.
export const giftedQuizCaptureLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 });
