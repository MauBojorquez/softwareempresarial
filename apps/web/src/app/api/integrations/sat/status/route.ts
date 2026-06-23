import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";
import { refreshSatCredential } from "@/server/services/sat/sync-sat-metrics";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await ensureMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  const orgId = membership.organizationId;

  const credential = await db.satCredential.findUnique({
    where: { organizationId: orgId },
  });

  if (!credential) {
    return NextResponse.json({ connected: false });
  }

  const pendingRequests = await db.satDownloadRequest.count({
    where: {
      organizationId: orgId,
      status: { notIn: ["downloaded", "failed", "expired"] },
    },
  });

  // Self-heal: in addition to the daily cron, nudge the sync forward when
  // someone is looking at the SAT status — but throttled so we never hammer
  // the SAT web service. We only act if nothing has been checked recently
  // (in-flight requests) or the data is plainly stale (idle org).
  //
  // IMPORTANT: we AWAIT this. On Vercel serverless the function is frozen as
  // soon as the response is returned, so a fire-and-forget (`void ...`) would
  // usually be killed before the SAT poll completes — leaving the sync stuck
  // forever between daily cron runs. The throttle inside guarantees the heavy
  // work runs at most once per window, so awaiting keeps responses snappy.
  await maybeBackgroundRefresh(orgId, credential.lastSyncAt, pendingRequests);

  // Re-read so the response reflects any progress the self-heal just made.
  const fresh = await db.satCredential.findUnique({
    where: { organizationId: orgId },
  });
  const freshPending = await db.satDownloadRequest.count({
    where: {
      organizationId: orgId,
      status: { notIn: ["downloaded", "failed", "expired"] },
    },
  });

  return NextResponse.json({
    connected: true,
    rfc: (fresh ?? credential).rfc,
    syncStatus: (fresh ?? credential).syncStatus,
    lastSyncAt: (fresh ?? credential).lastSyncAt?.toISOString() ?? null,
    lastError: (fresh ?? credential).lastError ?? null,
    pendingRequests: freshPending,
  });
}

// Throttle window for the on-view self-heal so repeated status polls don't
// trigger repeated SAT calls.
const POLL_THROTTLE_MS = 15 * 60 * 1000; // 15 min
const STALE_MS = 20 * 60 * 60 * 1000; // 20h

async function maybeBackgroundRefresh(
  orgId: string,
  lastSyncAt: Date | null,
  pendingRequests: number,
) {
  try {
    if (pendingRequests > 0) {
      // Only poll if no in-flight request was checked in the last 15 minutes.
      const recent = await db.satDownloadRequest.findFirst({
        where: {
          organizationId: orgId,
          status: { in: ["pending", "accepted", "finished"] },
          lastCheckedAt: { gte: new Date(Date.now() - POLL_THROTTLE_MS) },
        },
        select: { id: true },
      });
      if (recent) return; // checked recently — let the throttle hold
    } else {
      // Idle org: only refresh when the data is actually stale.
      if (lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < STALE_MS) {
        return;
      }
    }
    await refreshSatCredential(orgId, lastSyncAt);
  } catch {
    // Background best-effort; failures are recorded on the credential.
  }
}
