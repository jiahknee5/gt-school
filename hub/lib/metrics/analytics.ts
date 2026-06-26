// analytics.ts — Module 13 single metric definitions over GA4 (stand-in `ga4_days`).
// GA4 is the source of truth and is read per-site + aggregate BY SUMMATION (no cross-
// property double-count, invariant #1). bounce is defined EXACTLY ONCE here as
// 1 − engagedSessions/sessions (invariant #2). `(not set)`/null UTM is an explicit bucket,
// never dropped (invariant #3). Derived GA4 fields the seed doesn't carry yet (newUsers,
// avgDuration, exits, pageType, downloads, paths) are computed deterministically from the
// row so we never touch the shared generate.ts/types.ts — additive, collision-free.

import type { Ga4Day, SeedDataset } from "@/lib/seed/types";
import { campaignByUtm } from "@/lib/seed/campaigns";
import type { Role } from "@/lib/phase2";

export type Site = "gt.school" | "anywhere.gt.school";
export const SITES: Site[] = ["gt.school", "anywhere.gt.school"];
export const NOT_SET = "(not set)";

// ───────────────────────── core roll-ups (SSOT) ─────────────────────────

export interface SiteTotals {
  site: Site | "aggregate";
  sessions: number;
  totalUsers: number;
  engagedSessions: number;
  screenPageViews: number;
  pdfDownloads: number;
  leads: number;
}

function blank(site: Site | "aggregate"): SiteTotals {
  return { site, sessions: 0, totalUsers: 0, engagedSessions: 0, screenPageViews: 0, pdfDownloads: 0, leads: 0 };
}

function addRow(t: SiteTotals, r: Ga4Day): void {
  t.sessions += r.sessions;
  t.totalUsers += r.totalUsers;
  t.engagedSessions += r.engagedSessions;
  t.screenPageViews += r.screenPageViews;
  t.pdfDownloads += r.eventCount_pdf_download;
  t.leads += r.eventCount_generate_lead;
}

/** Per-site totals + an aggregate that is EXACTLY the sum of the two sites. */
export function siteTotals(rows: Ga4Day[]): SiteTotals[] {
  const bySite = new Map<Site, SiteTotals>();
  for (const s of SITES) bySite.set(s, blank(s));
  const agg = blank("aggregate");
  for (const r of rows) {
    const t = bySite.get(r.site as Site);
    if (t) addRow(t, r);
    addRow(agg, r);
  }
  return [...SITES.map((s) => bySite.get(s)!), agg];
}

/** The ONE bounce definition: 1 − engagedSessions/sessions. */
export function bounce(sessions: number, engagedSessions: number): number {
  if (sessions <= 0) return 0;
  return Number((1 - engagedSessions / sessions).toFixed(4));
}

/** Deterministic new-vs-returning split (seed lacks newUsers → derive from totalUsers). */
export function newVsReturning(t: SiteTotals): { newUsers: number; returningUsers: number } {
  const newUsers = Math.round(t.totalUsers * 0.62);
  return { newUsers, returningUsers: t.totalUsers - newUsers };
}

/** Avg session duration (seconds) — deterministic stand-in from engagement ratio. */
export function avgSessionDuration(t: SiteTotals): number {
  if (t.sessions <= 0) return 0;
  return Number((60 + (t.engagedSessions / t.sessions) * 180).toFixed(1));
}

// ───────────────────────── 13b subpage performance ─────────────────────────

export type PageType = "landing" | "blog" | "resource" | "form" | "about";

export function pageType(landingPage: string): PageType {
  if (landingPage.includes("checker") || landingPage.includes("quiz")) return "form";
  if (landingPage.includes("resource") || landingPage.includes("download")) return "resource";
  if (landingPage.includes("blog")) return "blog";
  if (landingPage.includes("about")) return "about";
  return "landing";
}

export interface PageRow {
  landingPage: string;
  site: Site;
  pageType: PageType;
  sessions: number;
  users: number;
  pageViews: number;
  bounce: number;
  thresholded: boolean;
}

const THRESHOLD_MIN_SESSIONS = 10; // GA4 low-volume suppression boundary

export function subpagePerformance(rows: Ga4Day[]): PageRow[] {
  const m = new Map<string, PageRow>();
  for (const r of rows) {
    const key = `${r.site}|${r.landingPage}`;
    const cur = m.get(key) ?? {
      landingPage: r.landingPage,
      site: r.site as Site,
      pageType: pageType(r.landingPage),
      sessions: 0,
      users: 0,
      pageViews: 0,
      bounce: 0,
      thresholded: false,
    };
    cur.sessions += r.sessions;
    cur.users += r.totalUsers;
    cur.pageViews += r.screenPageViews;
    m.set(key, cur);
  }
  // recompute bounce from aggregated engaged/sessions per page
  const engagedByKey = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.site}|${r.landingPage}`;
    engagedByKey.set(key, (engagedByKey.get(key) ?? 0) + r.engagedSessions);
  }
  return [...m.entries()]
    .map(([key, row]) => ({
      ...row,
      bounce: bounce(row.sessions, engagedByKey.get(key) ?? 0),
      thresholded: row.sessions < THRESHOLD_MIN_SESSIONS, // flagged, never dropped (invariant #7)
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function topLandingPages(rows: Ga4Day[], n = 5): { landingPage: string; sessions: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.landingPage, (m.get(r.landingPage) ?? 0) + r.sessions);
  return [...m.entries()]
    .map(([landingPage, sessions]) => ({ landingPage, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, n);
}

// ───────────────────────── 13c traffic sources + UTM validation ─────────────────────────

export interface SourceRow {
  channel: string;
  sessions: number;
  leads: number;
}

export function trafficSources(rows: Ga4Day[]): SourceRow[] {
  const m = new Map<string, SourceRow>();
  for (const r of rows) {
    const ch = r.sessionDefaultChannelGroup || "Direct";
    const cur = m.get(ch) ?? { channel: ch, sessions: 0, leads: 0 };
    cur.sessions += r.sessions;
    cur.leads += r.eventCount_generate_lead;
    m.set(ch, cur);
  }
  return [...m.values()].sort((a, b) => b.sessions - a.sessions);
}

export type UtmStatus = "valid" | "invalid" | "missing";

export interface UtmValidationRow {
  utm_campaign: string;
  status: UtmStatus;
  sessions: number;
}

/** Validate UTMs vs the canonical taxonomy; `(not set)`/null → missing (counted). */
export function validateUtms(rows: Ga4Day[]): UtmValidationRow[] {
  const m = new Map<string, UtmValidationRow>();
  for (const r of rows) {
    const utm = r.utm_campaign ?? NOT_SET;
    const status: UtmStatus = r.utm_campaign == null ? "missing" : campaignByUtm(r.utm_campaign) ? "valid" : "invalid";
    const cur = m.get(utm) ?? { utm_campaign: utm, status, sessions: 0 };
    cur.sessions += r.sessions;
    m.set(utm, cur);
  }
  return [...m.values()].sort((a, b) => b.sessions - a.sessions);
}

export function utmValidationSummary(rows: Ga4Day[]): Record<UtmStatus, number> {
  const out: Record<UtmStatus, number> = { valid: 0, invalid: 0, missing: 0 };
  for (const v of validateUtms(rows)) out[v.status] += v.sessions;
  return out;
}

// ───────────────────────── 13d downloads ─────────────────────────

export interface DownloadRow {
  file: string;
  topReferringPage: string;
  downloadsWeekly: number;
  downloadsCumulative: number;
}

const RESOURCE_FILES = ["gifted-guide.pdf", "esa-faq.pdf", "curriculum-overview.pdf", "tuition-sheet.pdf"];

/**
 * Per-file rollup. The seed only carries aggregate eventCount_pdf_download, so file names
 * are a deterministic stand-in; the TOTAL reconciles exactly to the PDF widget (invariant
 * #4): sum(downloadRows.cumulative) == sum(eventCount_pdf_download).
 */
export function downloads(rows: Ga4Day[]): DownloadRow[] {
  const totalPdf = rows.reduce((a, r) => a + r.eventCount_pdf_download, 0);
  const topReferrer = topLandingPages(rows, 1)[0]?.landingPage ?? "/";
  // distribute deterministically across files so the sum is exact
  const weights = [4, 3, 2, 1];
  const wsum = weights.reduce((a, b) => a + b, 0);
  let allocated = 0;
  const out = RESOURCE_FILES.map((file, i) => {
    const share = i === RESOURCE_FILES.length - 1 ? totalPdf - allocated : Math.round((totalPdf * weights[i]) / wsum);
    allocated += i === RESOURCE_FILES.length - 1 ? 0 : share;
    return {
      file,
      topReferringPage: topReferrer,
      downloadsWeekly: Math.round(share / 13),
      downloadsCumulative: share,
    };
  });
  return out.sort((a, b) => b.downloadsCumulative - a.downloadsCumulative);
}

export function totalPdfDownloads(rows: Ga4Day[]): number {
  return rows.reduce((a, r) => a + r.eventCount_pdf_download, 0);
}

// ───────────────────────── 13e conversion paths (stand-in) ─────────────────────────

export interface PathStep {
  fromPage: string;
  toPage: string;
  count: number;
  standIn: true; // GA4 Data API can't return ordered sequences → BigQuery/path-explore TBD
}

export function conversionPaths(rows: Ga4Day[]): PathStep[] {
  const top = topLandingPages(rows, 3).map((p) => p.landingPage);
  const form = "/application";
  return top.map((entry, i) => ({
    fromPage: entry,
    toPage: form,
    count: Math.max(1, Math.round((rows.reduce((a, r) => a + r.eventCount_generate_lead, 0)) / (top.length + i))),
    standIn: true as const,
  }));
}

export interface PathFunnel {
  entryPage: string;
  stepsToForm: number;
  dropOffRate: number;
  standIn: true;
}

export function preFunnelJourney(rows: Ga4Day[]): PathFunnel {
  const entry = topLandingPages(rows, 1)[0]?.landingPage ?? "/";
  return { entryPage: entry, stepsToForm: 2, dropOffRate: 0.64, standIn: true };
}

// ───────────────────────── RBAC (invariant #8) ─────────────────────────

export function canRequestAnalysis(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader";
}

export function canFlagPage(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader";
}

export class AnalyticsAuthError extends Error {
  constructor(action: string) {
    super(`forbidden: ${action} requires Admin or Leader`);
    this.name = "AnalyticsAuthError";
  }
}

export function assertCanFlagPage(role: Role | null | undefined): void {
  if (!canFlagPage(role)) throw new AnalyticsAuthError("flag page");
}

// ───────────────────────── cross-module payloads ─────────────────────────

export interface ContentHypothesis {
  landingPage: string;
  site: Site;
  sessions: number;
  conversionRate: number;
  hypothesis: "refresh?";
  caveat: "source-mix confound";
}

/** Leader-confirmed underperforming-page hypothesis → Content (with the confound caveat). */
export function underperformingHypothesis(page: PageRow, leads: number): ContentHypothesis {
  return {
    landingPage: page.landingPage,
    site: page.site,
    sessions: page.sessions,
    conversionRate: page.sessions > 0 ? Number((leads / page.sessions).toFixed(4)) : 0,
    hypothesis: "refresh?",
    caveat: "source-mix confound",
  };
}

/** Convenience: pull rows out of the dataset. */
export function ga4Rows(ds: SeedDataset): Ga4Day[] {
  return ds.ga4_days;
}
