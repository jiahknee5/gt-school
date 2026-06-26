// upload.ts — the ≤4-field add flow (invariant #5). Required: title + ≥1 tag + visibility +
// (url|file). owner + date are auto-filled; the badge is derived (never typed). Returns the
// new row so the next list render shows it immediately.

import { deriveBadge } from "./badge";
import type { Resource, Tag, Visibility } from "./types";

export interface UploadInput {
  title: string;
  tags: Tag[];
  visibility: Visibility;
  url?: string | null;
  storagePath?: string | null;
  mime?: string | null;
  description?: string;
}

export function validateUpload(input: Partial<UploadInput>): string[] {
  const missing: string[] = [];
  if (!input.title?.trim()) missing.push("title");
  if (!input.tags || input.tags.length < 1) missing.push("tags");
  if (!input.visibility) missing.push("visibility");
  if (!input.url && !input.storagePath) missing.push("url|file");
  return missing;
}

export function addResource(input: UploadInput, currentUser: string, now = new Date().toISOString()): Resource {
  return {
    id: `res_${Math.abs(hash(input.title + now))}`,
    title: input.title.trim(),
    description: input.description ?? "",
    kind: input.storagePath ? "file" : "link",
    url: input.url ?? null,
    storagePath: input.storagePath ?? null,
    fileType: deriveBadge({ url: input.url, mime: input.mime }),
    tags: input.tags,
    owner: currentUser, // auto-filled
    visibility: input.visibility,
    linkCheckedAt: now,
    linkOk: true,
    isSample: false,
    createdAt: now,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
