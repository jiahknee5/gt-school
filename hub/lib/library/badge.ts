// badge.ts — the SINGLE source of badge truth (invariant #3). file_type is DERIVED from the
// URL pattern / MIME, never accepted as free text, so a Slides URL always badges SLIDES and
// a .pdf always badges PDF.

import type { FileBadge } from "./types";

export function deriveBadge(input: { url?: string | null; mime?: string | null }): FileBadge {
  const url = (input.url ?? "").toLowerCase();
  const mime = (input.mime ?? "").toLowerCase();

  if (url.includes("docs.google.com/presentation") || mime.includes("presentation")) return "SLIDES";
  if (url.includes("docs.google.com/spreadsheets") || mime.includes("spreadsheet")) return "SHEET";
  if (url.includes("docs.google.com/document") || mime.includes("msword") || mime.includes("wordprocessing")) return "DOC";
  if (url.endsWith(".pdf") || mime === "application/pdf") return "PDF";
  if (url.endsWith(".md") || mime === "text/markdown") return "MD";
  if (url.endsWith(".html") || url.endsWith(".htm") || mime === "text/html") return "HTML";
  // sensible default for an unrecognised Google Doc-style link
  if (url.includes("docs.google.com")) return "DOC";
  return "HTML";
}
