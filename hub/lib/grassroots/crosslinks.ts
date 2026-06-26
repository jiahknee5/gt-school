// crosslinks.ts — idempotent outbound cross-links. A testimonial logged once creates ONE
// Content stub (invariant #9). A hot-family flag carries MINIMIZED PII only (first name +
// grade + reason code; no notes), per Elena Schwartz (invariant #10). Parent-led events
// are owned HERE and emitted read-only to Field Marketing (invariant #11).

export interface ContentStub {
  stubId: string;
  ambassadorMatchKey: string;
  summary: string;
  dedupeKey: string;
}

export function testimonialDedupeKey(ambassadorMatchKey: string): string {
  return `testimonial:${ambassadorMatchKey}`;
}

export function logTestimonial(
  existing: ContentStub[],
  ambassadorMatchKey: string,
  summary: string,
): { stubs: ContentStub[]; created: boolean } {
  const dedupeKey = testimonialDedupeKey(ambassadorMatchKey);
  if (existing.some((s) => s.dedupeKey === dedupeKey)) return { stubs: existing, created: false };
  const stub: ContentStub = {
    stubId: `stub_${ambassadorMatchKey.slice(0, 8)}`,
    ambassadorMatchKey,
    summary,
    dedupeKey,
  };
  return { stubs: [...existing, stub], created: true };
}

export interface HotFamilyFlag {
  familyId: string;
  childFirstName: string;
  childGrade: string;
  reasonCode: string;
  urgent: boolean;
  minimized: true; // enforced by construction
  dedupeKey: string;
}

/** PII-minimized hot-family flag: child first name + grade + reason code ONLY. */
export function minimizeHotFamily(
  familyId: string,
  childFirstName: string | null,
  childGrade: string | null,
  reasonCode: string,
  urgent: boolean,
): HotFamilyFlag {
  return {
    familyId,
    childFirstName: childFirstName ?? "(child)",
    childGrade: childGrade ?? "(grade)",
    reasonCode,
    urgent,
    minimized: true,
    dedupeKey: `hot_family:${familyId}:${reasonCode}`,
  };
}

export interface ParentEventCrossLink {
  eventId: string;
  name: string;
  date: string;
  host: string;
  type: string;
  readOnly: true; // Field Marketing has no write path
}

export function parentEventCrossLink(event: {
  id: string;
  name: string;
  date: string;
  host: string;
  type: string;
}): ParentEventCrossLink {
  return { eventId: event.id, name: event.name, date: event.date, host: event.host, type: event.type, readOnly: true };
}
