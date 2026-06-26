// sync.ts — field-level bidirectional reconcile (mirrors lib/sync/reconcile.ts). Neither
// system is orphaned: a sheet-only row appears in the Hub; a Hub status change pushes to
// the sheet; a BOTH-sides edit since last sync yields a conflict row with BOTH values
// retained — never a silent clobber (invariant #1).

export interface SyncField {
  pieceId: string;
  sheetRowId: string;
  field: string;
  appValue: string | null;
  sheetValue: string | null;
  appUpdatedAt: string | null;
  sheetUpdatedAt: string | null;
  lastSyncedAt: string | null;
}

export interface SyncState {
  pieceId: string;
  sheetRowId: string;
  field: string;
  appValue: string | null;
  sheetValue: string | null;
  inParity: boolean;
  conflict: boolean;
  /** last-writer-wins winner when not a conflict, null when conflicted. */
  resolved: string | null;
}

export function reconcileField(f: SyncField): SyncState {
  const inParity = f.appValue === f.sheetValue;
  const last = f.lastSyncedAt ? Date.parse(f.lastSyncedAt) : 0;
  const appEdited = f.appUpdatedAt ? Date.parse(f.appUpdatedAt) > last : false;
  const sheetEdited = f.sheetUpdatedAt ? Date.parse(f.sheetUpdatedAt) > last : false;
  const conflict = !inParity && appEdited && sheetEdited;
  let resolved: string | null = null;
  if (!inParity && !conflict) {
    // last-writer-wins by timestamp
    const appT = f.appUpdatedAt ? Date.parse(f.appUpdatedAt) : 0;
    const sheetT = f.sheetUpdatedAt ? Date.parse(f.sheetUpdatedAt) : 0;
    resolved = appT >= sheetT ? f.appValue : f.sheetValue;
  }
  return {
    pieceId: f.pieceId,
    sheetRowId: f.sheetRowId,
    field: f.field,
    appValue: f.appValue,
    sheetValue: f.sheetValue,
    inParity,
    conflict,
    resolved,
  };
}

/** Deterministic demo states: parity, sheet-wins LWW, and a real conflict. */
export function seedSyncStates(): SyncState[] {
  const early = "2026-06-09T00:00:00.000Z";
  const base = "2026-06-10T00:00:00.000Z";
  const latest = "2026-06-13T00:00:00.000Z";
  return [
    reconcileField({ pieceId: "piece_0", sheetRowId: "sheet_0", field: "status", appValue: "review", sheetValue: "review", appUpdatedAt: base, sheetUpdatedAt: base, lastSyncedAt: latest }),
    // one-sided (app only) edit since last sync → LWW, no conflict
    reconcileField({ pieceId: "piece_1", sheetRowId: "sheet_1", field: "status", appValue: "scheduled", sheetValue: "review", appUpdatedAt: latest, sheetUpdatedAt: early, lastSyncedAt: base }),
    // both edited since last sync → conflict, both retained
    reconcileField({ pieceId: "piece_2", sheetRowId: "sheet_2", field: "status", appValue: "published", sheetValue: "scheduled", appUpdatedAt: latest, sheetUpdatedAt: latest, lastSyncedAt: base }),
  ];
}
