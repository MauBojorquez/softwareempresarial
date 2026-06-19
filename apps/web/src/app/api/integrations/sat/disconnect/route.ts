import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";

export const runtime = "nodejs";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await ensureMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  const orgId = membership.organizationId;

  await db.satDownloadRequest.deleteMany({ where: { organizationId: orgId } });
  await db.satCredential.deleteMany({ where: { organizationId: orgId } });
  await db.metric.deleteMany({ where: { organizationId: orgId, source: "SAT" } });

  return NextResponse.json({ success: true });
}
