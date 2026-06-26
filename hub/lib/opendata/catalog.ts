/**
 * Open Data catalog — the "view across all available datasets". Wraps the
 * platform's discovery endpoints (`/v1/stats`, `/v1/providers`, `/v1/search`)
 * and curates them for GT: Texas school data and other education providers are
 * surfaced first, everything else is browsable underneath.
 *
 * Read-only and cached (via fetchOpenDataJson). Nothing here is a source of
 * truth — it's a map of what the Hub CAN pull at decision time.
 */

import { fetchOpenDataJson, type FetchOptions, type JsonResult } from "./client";

export interface PlatformStats {
  totalProviders: number;
  totalDatasets: number;
  totalRows: number;
  addedThisWeek: number;
}

export interface ProviderSummary {
  slug: string;
  name: string;
  description: string | null;
  datasetCount: number;
  totalRows: number;
}

export interface DatasetSummary {
  name: string;
  slug: string;
  provider: string;
  path: string;
  description: string;
  rows: number;
  categories: string[];
  geographicScope: string | null;
  temporalGranularity: string | null;
  qualityScore: number | null;
  updatedAt: string | null;
}

/**
 * Curated tiers for GT. Texas school data is the home market; the broader
 * education tier (NCES + other state DOEs) is the next ring out.
 */
export const TEXAS_SCHOOL_PROVIDERS = [
  "tea", // Texas Education Agency — PEIMS, STAAR, A–F accountability
  "tefa", // Texas Education Freedom Accounts — the voucher
  "tx-comptroller", // school finance, property value, tax rates
  "austin-isd",
  "hisd", // Houston ISD
  "texas-isd",
  "brb", // Bond Review Board — ISD debt
  "travis-county",
] as const;

export const EDUCATION_PROVIDERS = ["nces", "ed", "fldoe", "isbe"] as const;

const TEXAS_SET = new Set<string>(TEXAS_SCHOOL_PROVIDERS);
const EDU_SET = new Set<string>(EDUCATION_PROVIDERS);

export type ProviderTier = "texas-school" | "education" | "other";

export function providerTier(slug: string): ProviderTier {
  if (TEXAS_SET.has(slug)) return "texas-school";
  if (EDU_SET.has(slug)) return "education";
  return "other";
}

interface RawProviderList {
  items?: Array<{
    slug: string;
    name: string;
    description?: string | null;
    dataset_count?: number;
    total_rows?: number;
  }>;
}

interface RawSearchResponse {
  results?: Array<{
    name?: string;
    slug?: string;
    provider?: string;
    path?: string;
    description?: string;
    rows?: number;
    categories?: string[];
    geographic_scope?: string | null;
    temporal_granularity?: string | null;
    quality_score?: number | null;
    updated_at?: string | null;
  }>;
  total?: number;
}

export async function getPlatformStats(
  opts?: FetchOptions,
): Promise<JsonResult<PlatformStats>> {
  const res = await fetchOpenDataJson<{
    totalProviders: number;
    totalDatasets: number;
    totalRows: number;
    addedThisWeek: number;
  }>("/v1/stats", opts);
  return {
    ...res,
    data: {
      totalProviders: res.data.totalProviders ?? 0,
      totalDatasets: res.data.totalDatasets ?? 0,
      totalRows: res.data.totalRows ?? 0,
      addedThisWeek: res.data.addedThisWeek ?? 0,
    },
  };
}

export async function listProviders(
  opts?: FetchOptions,
): Promise<JsonResult<ProviderSummary[]>> {
  const res = await fetchOpenDataJson<RawProviderList>("/v1/providers?limit=100", opts);
  const providers: ProviderSummary[] = (res.data.items ?? [])
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description ?? null,
      datasetCount: p.dataset_count ?? 0,
      totalRows: p.total_rows ?? 0,
    }))
    .filter((p) => p.datasetCount > 0);
  return { ...res, data: providers };
}

/** Group providers into GT's curated tiers, each sorted by dataset count. */
export function curateProviders(providers: ProviderSummary[]): Record<ProviderTier, ProviderSummary[]> {
  const tiers: Record<ProviderTier, ProviderSummary[]> = {
    "texas-school": [],
    education: [],
    other: [],
  };
  for (const p of providers) tiers[providerTier(p.slug)].push(p);
  const byCount = (a: ProviderSummary, b: ProviderSummary) => b.datasetCount - a.datasetCount;
  tiers["texas-school"].sort(byCount);
  tiers.education.sort(byCount);
  tiers.other.sort(byCount);
  return tiers;
}

/**
 * List a provider's datasets (rich rows: row counts, categories, scope) via the
 * search endpoint scoped to that provider. `q` is optional free-text within it.
 */
export async function listProviderDatasets(
  provider: string,
  opts?: FetchOptions & { q?: string; limit?: number },
): Promise<JsonResult<DatasetSummary[]>> {
  const params = new URLSearchParams();
  params.set("provider", provider);
  params.set("limit", String(opts?.limit ?? 100));
  params.set("status", "ready");
  if (opts?.q) params.set("q", opts.q);
  const res = await fetchOpenDataJson<RawSearchResponse>(`/v1/search?${params.toString()}`, opts);
  return { ...res, data: normalizeSearch(res.data) };
}

/** Free-text search across all datasets. */
export async function searchDatasets(
  q: string,
  opts?: FetchOptions & { limit?: number },
): Promise<JsonResult<DatasetSummary[]>> {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", String(opts?.limit ?? 50));
  params.set("status", "ready");
  const res = await fetchOpenDataJson<RawSearchResponse>(`/v1/search?${params.toString()}`, opts);
  return { ...res, data: normalizeSearch(res.data) };
}

function normalizeSearch(raw: RawSearchResponse): DatasetSummary[] {
  return (raw.results ?? []).map((r) => ({
    name: r.name ?? r.slug ?? "(unnamed)",
    slug: r.slug ?? "",
    provider: r.provider ?? "",
    path: r.path ?? "",
    description: r.description ?? "",
    rows: r.rows ?? 0,
    categories: r.categories ?? [],
    geographicScope: r.geographic_scope ?? null,
    temporalGranularity: r.temporal_granularity ?? null,
    qualityScore: r.quality_score ?? null,
    updatedAt: r.updated_at ?? null,
  }));
}

/** Compact human label for large row counts (e.g. 136448498 → "136M"). */
export function formatRows(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
