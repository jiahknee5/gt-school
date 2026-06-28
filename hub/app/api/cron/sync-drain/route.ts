// Background sync driver. Scheduled by Vercel Cron (vercel.json) to keep HubSpot and the
// internal Phase 1 DB in sync without anyone clicking anything:
//   1. drainOutbox() — dispatch queued app→HubSpot intents (upsert_contact, patch_deal).
//   2. reconcile()   — pull HubSpot→app changes since the last cursor (inbound).
//   3. runParityCheck() — recompute field-level parity so the data-confidence banner is fresh.
//
// Secured by CRON_SECRET exactly like status-refresh: Vercel sends
// `Authorization: Bearer <CRON_SECRET>` for the scheduled GET. POST is the admin/leader
// "sync now" for demos (same work, role-gated). Without a secret it runs only outside prod.

import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { drainOutbox } from "@/lib/sync/outbox-worker";
import { reconcile } from "@/lib/sync/reconcile";
import { runParityCheck } from "@/lib/parity";

export const runtime = "nodejs"; // postgres pool + HubSpot fetch
export const dynamic = "force-dynamic";

function authorizeCron(req: Request): { ok: boolean; status: 401 | 503 } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "production" ? { ok: false, status: 503 } : { ok: true, status: 401 };
  }
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("secret") ?? "";
  return { ok: provided === secret, status: 401 };
}

async function runSync() {
  if (!process.env.APP_RW_DATABASE_URL) {
    return { ok: false, skipped: "no APP_RW_DATABASE_URL", at: new Date().toISOString() };
  }
  // Outbound first (push our writes to HubSpot), then inbound (pull HubSpot changes),
  // then recompute parity so the freshly-synced state drives the confidence banner.
  //
  // drainOutbox dispatches over HTTP INSIDE a 6s-deadline'd transaction, so a large
  // batch (limit 50) blows the deadline and rolls back. Drain in small batches that each
  // finish well under 6s, looping until the queue is clear (or a safety cap).
  let done = 0, dead = 0, retried = 0, passes = 0;
  let drainErr: string | null = null;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await drainOutbox({ limit: 4 });
      passes++;
      done += r.done.length; dead += r.dead.length; retried += r.retried.length;
      if (r.claimed === 0) break;
    } catch (e) {
      drainErr = String(e instanceof Error ? e.message : e);
      break;
    }
  }
  const drained = drainErr ? { error: drainErr, done, dead, retried, passes } : { done, dead, retried, passes };
  const inbound = await reconcile().catch((e) => ({ error: String(e instanceof Error ? e.message : e) }));
  const parity = await runParityCheck().catch((e) => ({ error: String(e instanceof Error ? e.message : e) }));
  return { ok: true, at: new Date().toISOString(), drained, inbound, parity };
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = authorizeCron(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "CRON_SECRET not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  return NextResponse.json(await runSync());
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireRole(["admin", "leader"]); // "sync now" for demos
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  return NextResponse.json(await runSync());
}
