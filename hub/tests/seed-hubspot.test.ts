import { describe, expect, it } from "vitest";
import {
  contactProperties,
  mapGradeBand,
  mapIncomeBand,
  mapSource,
  mapTefaStatus,
} from "../scripts/seed-hubspot";

describe("seed-hubspot bridge mappings", () => {
  it("maps app-owned family values onto the existing HubSpot enum vocabulary", () => {
    expect(mapIncomeBand("<65K")).toBe("under_65k");
    expect(mapIncomeBand("65-160K")).toBe("65k_160k");
    expect(mapIncomeBand("160K+")).toBe("over_160k");

    expect(mapGradeBand("K")).toBe("k_2");
    expect(mapGradeBand("5")).toBe("3_5");
    expect(mapGradeBand("8")).toBe("6_8");
    expect(mapGradeBand("12")).toBe("9_12");

    expect(mapTefaStatus("esa_planned")).toBe("planned");
    expect(mapTefaStatus("eligible")).toBe("approved");
    expect(mapTefaStatus("esa_ineligible")).toBe("ineligible");
    expect(mapTefaStatus("frozen_2027")).toBe("none");

    expect(mapSource("x")).toBe("x_twitter");
    expect(mapSource("community")).toBe("gifted_community");
    expect(mapSource("direct")).toBe("organic");
  });

  it("keeps dry bridge payloads identity-only unless syncFields is requested", () => {
    const family = {
      id: "fam-1",
      hubspot_contact_id: "hs-1000",
      email: "parent@example.com",
      phone: "(512) 555-1234",
      first_name: "Ada",
      last_name: "Lovelace",
      funnel_stage: "deposit",
      tefa_status: "eligible",
      income_band: "160K+",
      grade: "2",
      lifecycle_stage: "customer",
      lead_score: 92,
      source: "x",
      created_at: "2026-06-26T00:00:00.000Z",
    };

    expect(contactProperties(family, { syncFields: false })).toEqual({
      email: "parent@example.com",
      firstname: "Ada",
      lastname: "Lovelace",
      phone: "(512) 555-1234",
      gt_ext_id: "family:fam-1",
      gt_seed_batch: "gt_hub_bridge_v1",
    });

    expect(contactProperties(family, { syncFields: true })).toMatchObject({
      lifecyclestage: "customer",
      gt_lead_score: "92",
      gt_utm_source: "x_twitter",
      gt_income_band: "over_160k",
      gt_grade_band: "k_2",
      gt_esa_status: "approved",
    });
  });
});
