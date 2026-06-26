import { describe, expect, it } from "vitest";
import { matchKey, mockConnector } from "../lib/connectors/SourceConnector";

const HEX64 = /^[0-9a-f]{64}$/;

describe("matchKey — dual-source identity resolution", () => {
  it("returns a 64-char sha256 hex when a signal exists", () => {
    expect(matchKey({ email: "a@b.com" })).toMatch(HEX64);
  });

  it("prefers email over phone over name+zip", () => {
    const all = matchKey({
      email: "a@b.com",
      phone: "5551234567",
      firstName: "Ava",
      lastName: "Reyes",
      zip: "78704",
    });
    expect(all).toBe(matchKey({ email: "a@b.com" }));
  });

  it("normalizes email (trim + lowercase)", () => {
    expect(matchKey({ email: "  Foo@Bar.com " })).toBe(
      matchKey({ email: "foo@bar.com" }),
    );
  });

  it("falls back to phone and normalizes to digits only", () => {
    const a = matchKey({ phone: "(512) 555-0142" });
    const b = matchKey({ phone: "512-555-0142" });
    const c = matchKey({ phone: "5125550142" });
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toMatch(HEX64);
  });

  it("ignores too-short phone strings", () => {
    expect(matchKey({ phone: "12345" })).toBeNull();
  });

  it("falls back to name+zip, insensitive to case and surrounding space", () => {
    const a = matchKey({ firstName: " Ava ", lastName: "Reyes", zip: "78704" });
    const b = matchKey({ firstName: "ava", lastName: "reyes", zip: " 78704 " });
    expect(a).toBe(b);
    expect(a).toMatch(HEX64);
  });

  it("requires BOTH name and zip for the fallback", () => {
    expect(matchKey({ firstName: "Ava", lastName: "Reyes" })).toBeNull();
    expect(matchKey({ zip: "78704" })).toBeNull();
  });

  it("returns null when no usable signal is present", () => {
    expect(matchKey({})).toBeNull();
    expect(
      matchKey({ email: "  ", phone: "", firstName: "", lastName: "", zip: "" }),
    ).toBeNull();
  });

  it("tags key type so a phone never collides with a like-stringed email", () => {
    expect(matchKey({ phone: "5551234567" })).not.toBe(
      matchKey({ email: "5551234567" }),
    );
  });

  it("is deterministic and distinguishes different identities", () => {
    expect(matchKey({ email: "x@y.com" })).toBe(matchKey({ email: "x@y.com" }));
    expect(matchKey({ email: "a@b.com" })).not.toBe(
      matchKey({ email: "c@d.com" }),
    );
  });
});

describe("mockConnector", () => {
  it("exposes a clearly-labeled name", () => {
    expect(mockConnector("summer").name).toBe("mock:summer");
  });

  it("returns seeded, mock-labeled records", async () => {
    const recs = await mockConnector("summer").fetchSince(new Date(0));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.externalId.startsWith("mock-summer-"))).toBe(true);
    expect(recs.every((r) => r.raw?._mock === true)).toBe(true);
  });

  it("filters fetchSince by date", async () => {
    const future = await mockConnector("community").fetchSince(
      new Date("2030-01-01T00:00:00Z"),
    );
    expect(future.length).toBe(0);
  });

  it("every seeded record resolves to a non-null matchKey", async () => {
    const recs = await mockConnector("meta").fetchSince(new Date(0));
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(matchKey(r)).toMatch(HEX64);
    }
  });

  it("verifyWebhook accepts (mock) and pushUpdate is a no-op", async () => {
    const c = mockConnector("ga4");
    expect(c.verifyWebhook({ headers: {}, rawBody: "{}" })).toBe(true);
    await expect(
      c.pushUpdate({ externalId: "x", fields: {} }),
    ).resolves.toBeUndefined();
  });
});
