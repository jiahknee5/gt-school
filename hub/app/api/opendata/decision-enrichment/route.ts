import { NextResponse } from "next/server";
import { enrichDecisionByCounties } from "@/lib/opendata/enrich";

/**
 * GET /api/opendata/decision-enrichment?counties=TRAVIS,DALLAS&schoolYear=2024-2025&financeYear=2024
 *
 * The Hub's read-only Open Data enrichment endpoint. Pulls Texas A–F ratings +
 * gifted-program spend for the requested counties and returns a decision signal
 * (e.g. for the Decision Queue's "$18K Austin + Dallas chess street team" ask).
 *
 * Resilient by design: the underlying client degrades to cached then stood-in
 * fixture data on network failure, and the response reports its `source` so the
 * UI can show whether the numbers are live, cached, or stand-in.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const counties = (searchParams.get("counties") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (counties.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one county, e.g. ?counties=TRAVIS,DALLAS" },
      { status: 400 },
    );
  }

  const schoolYear = searchParams.get("schoolYear") ?? undefined;
  const financeYearRaw = searchParams.get("financeYear");
  const financeYear = financeYearRaw ? Number(financeYearRaw) : undefined;
  const refresh = searchParams.get("refresh") === "1";

  try {
    const enrichment = await enrichDecisionByCounties(counties, {
      schoolYear,
      financeYear: Number.isFinite(financeYear) ? financeYear : undefined,
      refresh,
    });
    return NextResponse.json(enrichment, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Open Data request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
