// data.ts — the mocked pre-loaded shelf (PRD says real docs aren't provided). Every row is
// is_sample=true so a reset restores a known state (invariant #8). "Brand Strategy" is
// leadership-only (the concrete RBAC-denial target). One row has link_ok=false to exercise
// the "link unreachable" state, and a 5th MD note exercises every badge.

import { deriveBadge } from "./badge";
import type { Resource } from "./types";

const CHECKED = "2026-06-25T00:00:00.000Z";
const CREATED = "2026-06-10T00:00:00.000Z";

function sample(r: Omit<Resource, "fileType" | "isSample">): Resource {
  return { ...r, fileType: deriveBadge({ url: r.url }), isSample: true };
}

export const SAMPLE_RESOURCES: Resource[] = [
  sample({
    id: "res_plan",
    title: "Go-Forward Marketing Plan",
    description: "The quarter's marketing plan and playbook.",
    kind: "link",
    url: "https://docs.google.com/document/d/marketing-plan",
    storagePath: null,
    tags: ["strategy", "playbook"],
    owner: "Marketing Lead",
    visibility: "all",
    linkCheckedAt: CHECKED,
    linkOk: true,
    createdAt: CREATED,
  }),
  sample({
    id: "res_brand",
    title: "Brand Strategy",
    description: "Brand positioning and creative direction.",
    kind: "link",
    url: "https://docs.google.com/presentation/d/brand-strategy",
    storagePath: null,
    tags: ["strategy", "creative"],
    owner: "Marketing Lead",
    visibility: "leadership", // RBAC-denial target
    linkCheckedAt: CHECKED,
    linkOk: true,
    createdAt: CREATED,
  }),
  sample({
    id: "res_outcomes",
    title: "Outcomes / Results Tracker",
    description: "Weekly results and outcomes tracker.",
    kind: "link",
    url: "https://docs.google.com/spreadsheets/d/results-tracker",
    storagePath: null,
    tags: ["data"],
    owner: "Marketing Lead",
    visibility: "all",
    linkCheckedAt: CHECKED,
    linkOk: false, // link unreachable — exercises the dead-link state
    createdAt: CREATED,
  }),
  sample({
    id: "res_persona",
    title: "Persona Dossier v2",
    description: "Gifted-family persona research dossier.",
    kind: "file",
    url: "https://assets.gt.school/persona-dossier-v2.pdf",
    storagePath: "library/persona-dossier-v2.pdf",
    tags: ["persona"],
    owner: "Grassroots Owner",
    visibility: "all",
    linkCheckedAt: CHECKED,
    linkOk: true,
    createdAt: CREATED,
  }),
  sample({
    id: "res_prios",
    title: "Suggested Priorities note",
    description: "This week's suggested priorities (markdown note).",
    kind: "link",
    url: "https://notes.gt.school/suggested-prios.md",
    storagePath: null,
    tags: ["playbook"],
    owner: "Marketing Lead",
    visibility: "all",
    linkCheckedAt: CHECKED,
    linkOk: true,
    createdAt: CREATED,
  }),
];
