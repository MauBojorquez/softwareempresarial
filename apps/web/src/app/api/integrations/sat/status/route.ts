import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";

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

  return NextResponse.json({
    connected: true,
    rfc: credential.rfc,
    syncStatus: credential.syncStatus,
    lastSyncAt: credential.lastSyncAt?.toISOString() ?? null,
    lastError: credential.lastError ?? null,
    pendingRequests,
  });
}
