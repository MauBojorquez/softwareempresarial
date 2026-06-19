import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";
import {
  startSatDownload,
  pollSatDownloads,
} from "@/server/services/sat/sync-sat-metrics";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await ensureMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  const orgId = membership.organizationId;

  try {
    await startSatDownload(orgId);
    await pollSatDownloads(orgId);

    const credential = await db.satCredential.findUnique({
      where: { organizationId: orgId },
    });
    const pendingRequests = await db.satDownloadRequest.count({
      where: {
        organizationId: orgId,
        status: { notIn: ["downloaded", "failed", "expired"] },
      },
    });

    return NextResponse.json({
      success: true,
      syncStatus: credential?.syncStatus ?? "unknown",
      lastSyncAt: credential?.lastSyncAt?.toISOString() ?? null,
      lastError: credential?.lastError ?? null,
      pendingRequests,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al sincronizar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
