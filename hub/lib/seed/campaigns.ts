/**
 * Marketing campaign catalog — the join spine for Meta, GA4, X, and CRM.
 * Every paid/owned channel row carries the same utm_campaign so stand-in → live
 * is a drop-in swap. Families inherit these UTMs from their acquisition channel.
 */

export interface MarketingCampaign {
  key: string;
  name: string;
  /** Meta Ads campaign_id (Marketing API). */
  meta_campaign_id: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  /** HubSpot `families.source` value for CRM-joinable rows. */
  crm_source: string;
  /** GA4 sessionDefaultChannelGroup */
  ga4_channel: string;
  landing_page: string;
}

/** Paid Meta campaigns — map to `families.source = meta_ads`. */
export const META_CAMPAIGNS: readonly MarketingCampaign[] = [
  {
    key: "gifted_quiz",
    name: "GT Gifted Quiz — Lead Gen",
    meta_campaign_id: "23847101234560001",
    utm_campaign: "gifted_quiz_2026",
    utm_source: "meta",
    utm_medium: "paid_social",
    crm_source: "meta_ads",
    ga4_channel: "Paid Social",
    landing_page: "/gifted-quiz",
  },
  {
    key: "esa_checker",
    name: "ESA Eligibility Checker",
    meta_campaign_id: "23847101234560002",
    utm_campaign: "esa_checker_2026",
    utm_source: "meta",
    utm_medium: "paid_social",
    crm_source: "meta_ads",
    ga4_channel: "Paid Social",
    landing_page: "/esa-checker",
  },
  {
    key: "brand_awareness",
    name: "Brand Awareness — TX Parents",
    meta_campaign_id: "23847101234560003",
    utm_campaign: "brand_awareness_tx",
    utm_source: "meta",
    utm_medium: "paid_social",
    crm_source: "meta_ads",
    ga4_channel: "Paid Social",
    landing_page: "/",
  },
];

/** Organic X campaigns — map to `families.source = x_twitter`. */
export const X_CAMPAIGNS: readonly MarketingCampaign[] = [
  {
    key: "x_conviction",
    name: "X Organic — Conviction Posts",
    meta_campaign_id: "", // not on Meta
    utm_campaign: "x_conviction_june",
    utm_source: "twitter",
    utm_medium: "social",
    crm_source: "x_twitter",
    ga4_channel: "Organic Social",
    landing_page: "/anywhere",
  },
  {
    key: "x_esa_thread",
    name: "X Organic — ESA Thread",
    meta_campaign_id: "",
    utm_campaign: "x_esa_thread",
    utm_source: "twitter",
    utm_medium: "social",
    crm_source: "x_twitter",
    ga4_channel: "Organic Social",
    landing_page: "/esa-checker",
  },
];

/** Summer camp UTMs — map to summer.gt.school registrations. */
export const SUMMER_UTM = {
  utm_source: "summer_site",
  utm_medium: "referral",
  utm_campaign: "summer_camp_2026",
} as const;

export const ALL_CAMPAIGNS: readonly MarketingCampaign[] = [...META_CAMPAIGNS, ...X_CAMPAIGNS];

export function campaignByUtm(utm: string): MarketingCampaign | undefined {
  return ALL_CAMPAIGNS.find((c) => c.utm_campaign === utm);
}

export function campaignByMetaId(id: string): MarketingCampaign | undefined {
  return META_CAMPAIGNS.find((c) => c.meta_campaign_id === id);
}
