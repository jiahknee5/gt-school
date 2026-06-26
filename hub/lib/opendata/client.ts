/**
 * Open Data (tryopendata.ai) client — the Hub's READ-ONLY enrichment layer for
 * external public-school data (Texas PEIMS finances, STAAR, A–F accountability).
 *
 * Design decisions (see the chat that produced this + the Technical Brief):
 *   - We do NOT mirror TEA into Supabase. The big tables are huge (raw PEIMS is
 *     ~136M rows) and the data is annual behind a stable API — a local mirror
 *     buys nothing and creates a second source of truth to keep fresh. Instead we
 *     query at decision time and cache responses with a TTL.
 *   - Single-source-of-truth is preserved: funnel / income / grade stay
 *     authoritative in Supabase app_form. School stats are CONTEXT, never written
 *     back into a lead record.
 *   - Resilient demos: a fetch failure falls back to stale cache, then to a
 *     clearly-labeled stood-in fixture, so the walkthrough never depends on the
 *     network. Every response is tagged with its `source`.
 *
 * The query grammar mirrors the live API: `fields` (csv), `filter[col]=value`
 * (equality), `sort` (prefix `-` for desc), `limit`, plus `response_format=objects`
 * which we always set so callers get array-of-dicts rather than columnar arrays.
 */

export type OpenDataValue = string | number | boolean | null;
export type OpenDataRow = Record<string, OpenDataValue>;

export type OpenDataSource = "live" | "cache" | "fixture";

export interface OpenDataResult {
  data: OpenDataRow[];
  columns: string[];
  /** Total rows in the dataset (before filtering), as reported by the API. */
  totalRows: number;
  /** Rows matching the filter, when the API reports it. */
  filteredRows?: number;
  /** Where these rows came from — surfaced in the UI for honesty. */
  source: OpenDataSource;
  /** ISO timestamp the underlying rows were fetched (live) or snapshotted. */
  fetchedAt: string;
}

export interface DatasetQuery {
  fields?: string[];
  /** Equality filters keyed by column. Values are URL-encoded for you. */
  filter?: Record<string, string | number>;
  /** Column to sort by; prefix with `-` for descending. */
  sort?: string;
  limit?: number;
  offset?: number;
  /** Aggregate expressions, e.g. "avg(score),count(*)". */
  aggregate?: string;
  groupBy?: string;
  /** Named view; the API picks a default_view otherwise. */
  view?: string;
}

export interface FetchOptions {
  /** Cache TTL in ms. Default 24h — TEA data is annual, so this is generous. */
  ttlMs?: number;
  /** Bypass the cache and force a live fetch (still populates the cache). */
  refresh?: boolean;
  /** Per-request timeout in ms. Default 8s. */
  timeoutMs?: number;
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable clock (tests). Defaults to Date.now. */
  now?: () => number;
  /**
   * Fixture fallback used when the network fails and there is no fresh/stale
   * cache. Returns rows (already shaped) or null if no stand-in applies.
   */
  fixture?: (provider: string, dataset: string, query: DatasetQuery) => OpenDataRow[] | null;
}

interface CacheEntry {
  rows: OpenDataRow[];
  columns: string[];
  totalRows: number;
  filteredRows?: number;
  storedAt: number;
  fetchedAt: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;

const cache = new Map<string, CacheEntry>();

interface JsonCacheEntry {
  body: unknown;
  storedAt: number;
  fetchedAt: string;
}
const jsonCache = new Map<string, JsonCacheEntry>();

/** Clear the in-memory response caches (used by tests). */
export function clearOpenDataCache(): void {
  cache.clear();
  jsonCache.clear();
}

export function openDataBaseUrl(): string {
  return process.env.OPENDATA_API_BASE?.replace(/\/$/, "") || "https://api.tryopendata.ai";
}

/** Build the full request URL for a dataset query (exported for tests/debug). */
export function buildDatasetUrl(
  provider: string,
  dataset: string,
  query: DatasetQuery = {},
): string {
  const params = new URLSearchParams();
  params.set("response_format", "objects");
  if (query.fields?.length) params.set("fields", query.fields.join(","));
  if (query.sort) params.set("sort", query.sort);
  if (typeof query.limit === "number") params.set("limit", String(query.limit));
  if (typeof query.offset === "number") params.set("offset", String(query.offset));
  if (query.aggregate) params.set("aggregate", query.aggregate);
  if (query.groupBy) params.set("group_by", query.groupBy);
  if (query.view) params.set("view", query.view);
  if (query.filter) {
    for (const [col, value] of Object.entries(query.filter)) {
      params.set(`filter[${col}]`, String(value));
    }
  }
  return `${openDataBaseUrl()}/v1/datasets/${provider}/${dataset}?${params.toString()}`;
}

interface RawDatasetResponse {
  data?: OpenDataRow[];
  columns?: string[];
  total_rows?: number;
  filtered_rows?: number;
}

function authHeaders(): HeadersInit {
  const key = process.env.OPENDATA_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/**
 * Fetch a dataset slice. Order of resolution:
 *   1. Fresh cache (within TTL) unless `refresh`.
 *   2. Live API → populate cache.
 *   3. On failure: stale cache (any age) if present.
 *   4. On failure: fixture stand-in if provided.
 *   5. Otherwise rethrow.
 */
export async function fetchDataset(
  provider: string,
  dataset: string,
  query: DatasetQuery = {},
  opts: FetchOptions = {},
): Promise<OpenDataResult> {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? Date.now;
  const url = buildDatasetUrl(provider, dataset, query);

  const cached = cache.get(url);
  if (!opts.refresh && cached && now() - cached.storedAt < ttlMs) {
    return toResult(cached, "cache");
  }

  try {
    if (!fetchImpl) throw new Error("No fetch implementation available.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let raw: RawDatasetResponse;
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json", ...authHeaders() },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Open Data ${provider}/${dataset} → HTTP ${res.status}`);
      }
      raw = (await res.json()) as RawDatasetResponse;
    } finally {
      clearTimeout(timer);
    }

    const entry: CacheEntry = {
      rows: raw.data ?? [],
      columns: raw.columns ?? [],
      totalRows: raw.total_rows ?? (raw.data?.length ?? 0),
      filteredRows: raw.filtered_rows,
      storedAt: now(),
      fetchedAt: new Date(now()).toISOString(),
    };
    cache.set(url, entry);
    return toResult(entry, "live");
  } catch (err) {
    // Degrade gracefully so a demo/decision view never hard-fails on the network.
    if (cached) return toResult(cached, "cache");
    const fixtureRows = opts.fixture?.(provider, dataset, query) ?? null;
    if (fixtureRows) {
      return {
        data: fixtureRows,
        columns: query.fields ?? (fixtureRows[0] ? Object.keys(fixtureRows[0]) : []),
        totalRows: fixtureRows.length,
        filteredRows: fixtureRows.length,
        source: "fixture",
        fetchedAt: new Date(now()).toISOString(),
      };
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export interface JsonResult<T> {
  data: T;
  source: OpenDataSource;
  fetchedAt: string;
}

/**
 * Cached GET of an arbitrary Open Data JSON endpoint (catalog routes like
 * `/v1/providers`, `/v1/datasets`, `/v1/search`). Same TTL + degrade-to-stale
 * behavior as `fetchDataset`, but returns the parsed body untouched. No fixture
 * fallback — catalog pages handle the throw and render an offline state.
 */
export async function fetchOpenDataJson<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<JsonResult<T>> {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? Date.now;
  const url = path.startsWith("http")
    ? path
    : `${openDataBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;

  const cached = jsonCache.get(url);
  if (!opts.refresh && cached && now() - cached.storedAt < ttlMs) {
    return { data: cached.body as T, source: "cache", fetchedAt: cached.fetchedAt };
  }

  try {
    if (!fetchImpl) throw new Error("No fetch implementation available.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let body: unknown;
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json", ...authHeaders() },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Open Data ${path} → HTTP ${res.status}`);
      body = await res.json();
    } finally {
      clearTimeout(timer);
    }
    const entry: JsonCacheEntry = {
      body,
      storedAt: now(),
      fetchedAt: new Date(now()).toISOString(),
    };
    jsonCache.set(url, entry);
    return { data: body as T, source: "live", fetchedAt: entry.fetchedAt };
  } catch (err) {
    if (cached) {
      return { data: cached.body as T, source: "cache", fetchedAt: cached.fetchedAt };
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function toResult(entry: CacheEntry, source: OpenDataSource): OpenDataResult {
  return {
    data: entry.rows,
    columns: entry.columns,
    totalRows: entry.totalRows,
    filteredRows: entry.filteredRows,
    source,
    fetchedAt: entry.fetchedAt,
  };
}
