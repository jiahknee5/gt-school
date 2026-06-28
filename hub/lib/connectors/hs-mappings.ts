// hs-mappings.ts — app value → HubSpot custom-property enum vocabulary.
//
// Shared by the seed bridge (scripts/seed-hubspot.ts) AND the live GT Challenge
// capture path (lib/gt-challenge/store-db.ts), so a captured lead and a seeded
// family map onto the exact same gt_* enum values. The HubSpot enum options are
// provisioned by seed-hubspot.ts (--sync-fields); these helpers return undefined
// for anything outside that vocabulary so we never send an option HubSpot rejects.

export function mapIncomeBand(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "<65k" || v === "under_65k" || v === "under 65k") return "under_65k";
  if (v === "65-160k" || v === "65k_160k" || v === "65k-160k") return "65k_160k";
  if (v === "160k+" || v === "over_160k" || v === "over 160k") return "over_160k";
  return undefined;
}

export function mapGradeBand(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "prek" || v === "pre-k" || v === "k" || v === "1" || v === "2" || v === "k2") {
    return "k_2";
  }
  if (v === "3" || v === "4" || v === "5" || v === "g35" || v === "3_5") return "3_5";
  if (v === "6" || v === "7" || v === "8" || v === "g68" || v === "6_8") return "6_8";
  if (v === "9" || v === "10" || v === "11" || v === "12" || v === "g912" || v === "9_12") {
    return "9_12";
  }
  return undefined;
}

export function mapTefaStatus(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "esa_planned" || v === "planned") return "planned";
  if (v === "eligible" || v === "approved") return "approved";
  if (v === "esa_ineligible" || v === "ineligible") return "ineligible";
  if (v === "no_indicator" || v === "not_applicable" || v === "frozen_2027" || v === "none") {
    return "none";
  }
  return undefined;
}

export function mapSource(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  const mapped: Record<string, string> = {
    x: "x_twitter",
    x_twitter: "x_twitter",
    facebook: "facebook",
    instagram: "instagram",
    organic: "organic",
    referral: "referral",
    email: "email",
    word_of_mouth: "referral",
    community: "gifted_community",
    website: "organic",
    direct: "organic",
    // UTM mediums the GT Challenge ads use that still resolve to a known source enum.
    paid_social: "facebook",
    social: "facebook",
  };
  return mapped[v];
}

/** The fit bucket is already a clean enum (strong_fit | promising | explore) — pass through. */
export function mapFitBucket(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "strong_fit" || v === "promising" || v === "explore") return v;
  return undefined;
}
