// types.ts — Resource Library shapes. Deliberately flat (no versioning/approval/automation).
// Tags are a CONTROLLED vocabulary (every resource files under ≥1). visibility is the RBAC
// see-gate. Access/download counts are NEVER a column here — they are read-only from Analytics.

export type FileBadge = "DOC" | "SHEET" | "SLIDES" | "PDF" | "MD" | "HTML";
export type Visibility = "all" | "leadership";
export type Tag = "strategy" | "data" | "creative" | "persona" | "playbook";

export const TAGS: Tag[] = ["strategy", "data", "creative", "persona", "playbook"];

export interface Resource {
  id: string;
  title: string;
  description: string;
  kind: "link" | "file";
  url: string | null;
  storagePath: string | null;
  fileType: FileBadge; // derived from URL/MIME — never free text
  tags: Tag[]; // ≥1 from the controlled vocab
  owner: string;
  visibility: Visibility;
  linkCheckedAt: string | null;
  linkOk: boolean;
  isSample: boolean;
  createdAt: string;
}
