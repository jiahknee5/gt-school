// reconcile.ts — the dual-source ambassador reconcile: the module's defining hard part.
//
// community.gt.school and HubSpot are PEERS (neither canonical — Sara Kim). We join the
// two feeds by match_key and pick the golden stage by SURVIVORSHIP: most-advanced stage
// wins; a real disagreement is logged as a data_quality_issue (not silently overwritten,
// invariant #2). An ambassador present in both feeds collapses to exactly ONE golden row
// (no double-count, invariant #1). An unmapped/null status becomes Prospect + low
// confidence — never dropped (invariant #3).

import type { CommunityAmbassador, HubspotAmbassador } from "@/lib/seed/types";

export type Stage = "Prospect" | "Outreached" | "Onboarded" | "Active" | "Champion";

const STAGE_RANK: Record<Stage, number> = {
  Prospect: 0,
  Outreached: 1,
  Onboarded: 2,
  Active: 3,
  Champion: 4,
};

const FEED_STAGE: Record<string, Stage> = {
  prospect: "Prospect",
  outreached: "Outreached",
  onboarded: "Onboarded",
  active: "Active",
  champion: "Champion",
};

export interface GoldenAmbassador {
  matchKey: string;
  name: string;
  email: string;
  stage: Stage;
  sourceWinner: "community" | "hubspot" | "both";
  statusConfidence: "high" | "low";
}

export interface AmbassadorConflict {
  matchKey: string;
  name: string;
  communityStage: Stage;
  hubspotStage: Stage;
  winner: Stage;
}

export interface ReconcileResult {
  ambassadors: GoldenAmbassador[];
  conflicts: AmbassadorConflict[];
}

function mapStage(raw: string | null | undefined): { stage: Stage; mapped: boolean } {
  const key = (raw ?? "").toLowerCase().trim();
  const stage = FEED_STAGE[key];
  return stage ? { stage, mapped: true } : { stage: "Prospect", mapped: false };
}

export function reconcileAmbassadors(
  community: CommunityAmbassador[],
  hubspot: HubspotAmbassador[],
): ReconcileResult {
  const byKey = new Map<string, { community?: CommunityAmbassador; hubspot?: HubspotAmbassador }>();
  for (const c of community) {
    if (!c.match_key) continue;
    byKey.set(c.match_key, { ...byKey.get(c.match_key), community: c });
  }
  for (const h of hubspot) {
    if (!h.match_key) continue;
    byKey.set(h.match_key, { ...byKey.get(h.match_key), hubspot: h });
  }

  const ambassadors: GoldenAmbassador[] = [];
  const conflicts: AmbassadorConflict[] = [];

  for (const [matchKey, pair] of byKey) {
    const c = pair.community;
    const h = pair.hubspot;
    const name = c?.name ?? h?.name ?? "(unknown)";
    const email = c?.email ?? h?.email ?? "";

    const cMap = c ? mapStage(c.status) : null;
    const hMap = h ? mapStage(h.ambassador_status) : null;

    let stage: Stage;
    let sourceWinner: GoldenAmbassador["sourceWinner"];
    let confidence: GoldenAmbassador["statusConfidence"] = "high";

    if (cMap && hMap) {
      // both feeds present → survivorship (most-advanced wins)
      if (STAGE_RANK[cMap.stage] >= STAGE_RANK[hMap.stage]) {
        stage = cMap.stage;
        sourceWinner = "both";
      } else {
        stage = hMap.stage;
        sourceWinner = "both";
      }
      if (cMap.stage !== hMap.stage) {
        conflicts.push({ matchKey, name, communityStage: cMap.stage, hubspotStage: hMap.stage, winner: stage });
      }
      if (!cMap.mapped || !hMap.mapped) confidence = "low";
    } else if (cMap) {
      stage = cMap.stage;
      sourceWinner = "community";
      if (!cMap.mapped) confidence = "low";
    } else {
      stage = hMap!.stage;
      sourceWinner = "hubspot";
      if (!hMap!.mapped) confidence = "low";
    }

    ambassadors.push({ matchKey, name, email, stage, sourceWinner, statusConfidence: confidence });
  }

  ambassadors.sort((a, b) => STAGE_RANK[b.stage] - STAGE_RANK[a.stage] || a.name.localeCompare(b.name));
  return { ambassadors, conflicts };
}

export function stageRank(stage: Stage): number {
  return STAGE_RANK[stage];
}

export const ALL_STAGES: Stage[] = ["Prospect", "Outreached", "Onboarded", "Active", "Champion"];
