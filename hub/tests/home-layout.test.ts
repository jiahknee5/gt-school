import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildHomeWidgetPickerDonePayload,
  setHomeWidgetSelected,
  starterHomeWidgetPickerItems,
} from "@/app/_components/homeWidgetPickerState";
import {
  addWidget,
  layoutForUser,
  normalizeHomeLayoutItems,
  removeWidget,
  reorderWidget,
  resolveHomeWidgets,
  starterHomeLayout,
} from "@/lib/home/layout";
import { DEMO_USERS } from "@/lib/phase2";

const authMock = vi.hoisted(() => {
  class AuthError extends Error {
    status: 401 | 403;
    constructor(status: 401 | 403, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    requireSession: vi.fn(),
  };
});

const dbMock = vi.hoisted(() => ({
  withoutProgram: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMock);
vi.mock("@/lib/db", () => dbMock);

const { GET, PUT } = await import("@/app/api/home/layout/route");

const admin = DEMO_USERS.find((u) => u.role === "admin")!;
const leader = DEMO_USERS.find((u) => u.role === "leader")!;
const operator = DEMO_USERS.find((u) => u.role === "operator")!;

type SqlMock = {
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  calls: { text: string; values: unknown[] }[];
  json: (value: unknown) => unknown;
};

function sqlForResponses(...responses: unknown[][]): SqlMock {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (<T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve((responses[calls.length - 1] ?? []) as T);
  }) as SqlMock;
  sql.calls = calls;
  sql.json = (value: unknown) => value;
  return sql;
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/home/layout", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Home layout helpers", () => {
  it("builds role-aware starter layouts with stable order", () => {
    expect(starterHomeLayout(leader).map((item) => item.widget_key)).toContain("decision-preview");
    expect(starterHomeLayout(operator).map((item) => item.widget_key)).toContain("content-pipeline");
    expect(starterHomeLayout(admin).map((item) => item.order)).toEqual(
      starterHomeLayout(admin).map((_, index) => index),
    );
  });

  it("adds, removes, and reorders widgets without duplicate keys", () => {
    const started = starterHomeLayout(operator);
    const added = addWidget(started, "top-objections");
    const duplicate = addWidget(added, "top-objections");
    const moved = reorderWidget(duplicate, "top-objections", 0);
    const removed = removeWidget(moved, "content-pipeline");

    expect(duplicate).toHaveLength(added.length);
    expect(moved[0].widget_key).toBe("top-objections");
    expect(removed.map((item) => item.widget_key)).not.toContain("content-pipeline");
    expect(removed.map((item) => item.order)).toEqual(removed.map((_, index) => index));
  });

  it("keeps saved empty layouts distinct from missing rows", () => {
    const empty = layoutForUser(operator, {
      user_id: operator.id,
      role: operator.role,
      widgets: [],
      version: 4,
      updated_at: "2026-06-26T12:00:00.000Z",
    });

    expect(empty.persisted).toBe(true);
    expect(empty.widgets).toEqual([]);
    expect(empty.version).toBe(4);
  });

  it("normalizes saved shapes and tolerates unknown widget keys", () => {
    const fallback = starterHomeLayout(operator);
    const normalized = normalizeHomeLayoutItems(
      [
        { key: "custom-legacy-widget", size: "bad-size", order: 1 },
        { widgetKey: "top-objections", size: "s", order: 0 },
        { widget_key: "top-objections", size: "large", order: 2 },
      ],
      fallback,
    );

    expect(normalized.widgets.map((item) => item.widget_key)).toEqual([
      "top-objections",
      "custom-legacy-widget",
    ]);
    expect(normalized.widgets[0].size).toBe("small");
    expect(normalized.widgets[1].size).toBe("medium");
    expect(normalized.warnings).toContain("unknown_custom-legacy-widget");
    expect(normalized.warnings).toContain("duplicate_top-objections");
    expect(resolveHomeWidgets(normalized.widgets)[1].widget).toBeNull();
  });
});

describe("GET /api/home/layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireSession.mockResolvedValue(operator);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the signed-in user's saved layout only", async () => {
    const savedWidgets = [
      { widget_key: "content-pipeline", size: "small", order: 0 },
      { widget_key: "top-objections", size: "medium", order: 1 },
    ];
    const sql = sqlForResponses([
      {
        user_id: operator.id,
        role: operator.role,
        widgets: savedWidgets,
        version: 3,
        updated_at: "2026-06-26T12:00:00.000Z",
      },
    ]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.layout.persisted).toBe(true);
    expect(body.layout.user_id).toBe(operator.id);
    expect(body.layout.widgets).toEqual(savedWidgets);
    expect(sql.calls[0].values).toEqual([operator.id]);
  });

  it("falls back to a starter layout when no row exists", async () => {
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sqlForResponses([])));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.layout.persisted).toBe(false);
    expect(body.layout.widgets.map((item: { widget_key: string }) => item.widget_key)).toContain(
      "content-pipeline",
    );
  });
});

describe("PUT /api/home/layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireSession.mockResolvedValue(operator);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ignores spoofed user ids and upserts only the signed-in user's layout", async () => {
    const sql = sqlForResponses([
      {
        user_id: operator.id,
        role: operator.role,
        widgets: [
          { widget_key: "top-objections", size: "small", order: 0 },
          { widget_key: "custom-legacy-widget", size: "medium", order: 1 },
        ],
        version: 2,
        updated_at: "2026-06-26T12:00:00.000Z",
      },
    ]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await PUT(
      jsonRequest({
        user_id: leader.id,
        widgets: [
          { key: "custom-legacy-widget", size: "bad-size", order: 1 },
          { widgetKey: "top-objections", size: "s", order: 0 },
        ],
      }),
    );
    const body = await res.json();
    const values = sql.calls[0].values;
    const writtenWidgets = values[2] as { widget_key: string }[];

    expect(res.status).toBe(200);
    expect(values[0]).toBe(operator.id);
    expect(values[1]).toBe(operator.role);
    expect(writtenWidgets.map((item: { widget_key: string }) => item.widget_key)).toEqual([
      "top-objections",
      "custom-legacy-widget",
    ]);
    expect(body.layout.user_id).toBe(operator.id);
    expect(body.layout.warnings).toContain("unknown_custom-legacy-widget");
  });

  it("can save an intentionally empty layout", async () => {
    const sql = sqlForResponses([
      {
        user_id: operator.id,
        role: operator.role,
        widgets: [],
        version: 5,
        updated_at: "2026-06-26T12:00:00.000Z",
      },
    ]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await PUT(jsonRequest({ widgets: [] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(sql.calls[0].values[2]).toEqual([]);
    expect(body.layout.widgets).toEqual([]);
    expect(body.layout.persisted).toBe(true);
  });

  it("accepts the Home Add Widget Done payload and persists the selected layout", async () => {
    const edited = setHomeWidgetSelected(
      starterHomeWidgetPickerItems(operator.role),
      "top-objections",
      true,
    );
    const payload = buildHomeWidgetPickerDonePayload(edited);
    const sql = sqlForResponses([
      {
        user_id: operator.id,
        role: operator.role,
        widgets: payload.widgets,
        version: 6,
        updated_at: "2026-06-26T12:00:00.000Z",
      },
    ]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await PUT(jsonRequest(payload));
    const body = await res.json();
    const writtenWidgets = sql.calls[0].values[2] as { widget_key: string; order: number }[];

    expect(res.status).toBe(200);
    expect(Object.keys(payload)).toEqual(["widgets"]);
    expect(writtenWidgets.map((item: { widget_key: string }) => item.widget_key)).toContain(
      "top-objections",
    );
    expect(writtenWidgets.map((item: { order: number }) => item.order)).toEqual(
      writtenWidgets.map((_: unknown, index: number) => index),
    );
    expect(body.layout.widgets.map((item: { widget_key: string }) => item.widget_key)).toContain(
      "top-objections",
    );
  });

  it("returns 401 before DB access when unauthenticated", async () => {
    authMock.requireSession.mockRejectedValueOnce(
      new authMock.AuthError(401, "Authentication required."),
    );

    const res = await PUT(jsonRequest({ widgets: [] }));

    expect(res.status).toBe(401);
    expect(dbMock.withoutProgram).not.toHaveBeenCalled();
  });
});
