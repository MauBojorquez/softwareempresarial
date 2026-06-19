import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const credential = await db.satCredential.findUnique({
    where: { organizationId: membership.organizationId },
  });

  if (!credential) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    rfc: credential.rfc,
    syncStatus: credential.syncStatus,
    lastSyncAt: credential.lastSyncAt?.toISOString() ?? null,
    lastError: credential.lastError ?? null,
  });
}
