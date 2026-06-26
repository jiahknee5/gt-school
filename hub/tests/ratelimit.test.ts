import { beforeEach, describe, expect, it } from "vitest";
import { clientKeyFromRequest, RateLimiter } from "@/lib/ratelimit";

const route = await import("@/app/api/gifted-quiz/route");

const strongAnswers = {
  patternReasoning: 5,
  curiosity: 5,
  readingAboveGrade: true,
  parentObservation:
    "Builds elaborate systems, asks advanced questions, and works through hard puzzles.",
};

function captureRequest(forwardedFor?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  return new Request("http://localhost/api/gifted-quiz", {
    method: "POST",
    headers,
    body: JSON.stringify({
      idempotency_key: `idem-${Math.random()}`,
      parent_consent: true,
      parent_email: "parent@example.com",
      child_grade: "2",
      answers: strongAnswers,
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "gifted_quiz_2026",
    }),
  });
}

describe("RateLimiter — fixed window", () => {
  it("allows up to the limit, then denies with a retry-after", () => {
    const clock = 1_000;
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => clock });

    const first = limiter.check("1.2.3.4");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);

    const blocked = limiter.check("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("isolates buckets per client key", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    // A different client still gets its own allowance.
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("resets the window once it elapses", () => {
    let clock = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000, now: () => clock });
    expect(limiter.check("c").allowed).toBe(true);
    expect(limiter.check("c").allowed).toBe(false);
    clock = 1_001;
    expect(limiter.check("c").allowed).toBe(true);
  });

  it("rejects invalid configuration", () => {
    expect(() => new RateLimiter({ limit: 0, windowMs: 1_000 })).toThrow();
    expect(() => new RateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe("clientKeyFromRequest", () => {
  it("uses the left-most x-forwarded-for hop", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" },
    });
    expect(clientKeyFromRequest(req)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip then a shared closed bucket", () => {
    const withReal = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(clientKeyFromRequest(withReal)).toBe("198.51.100.9");
    expect(clientKeyFromRequest(new Request("http://localhost/"))).toBe("unknown");
  });
});

describe("POST /api/gifted-quiz — rate limited", () => {
  beforeEach(() => {
    route.__resetGiftedQuizCaptureStoreForTests();
  });

  it("throttles a flood from one client with 429 + Retry-After", async () => {
    const client = "203.0.113.50";
    let last: Response | undefined;
    // The shared limiter allows 10/min; the 11th from the same client is blocked.
    for (let i = 0; i < 11; i += 1) {
      last = await route.POST(captureRequest(client));
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBeTruthy();
    const body = await last?.json();
    expect(body.error).toContain("Too many");
  });

  it("does not penalize a separate client", async () => {
    route.__resetGiftedQuizCaptureStoreForTests();
    const res = await route.POST(captureRequest("203.0.113.99"));
    expect(res.status).toBe(200);
  });
});
