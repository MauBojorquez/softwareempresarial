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
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const integrations = await db.integration.findMany({
    where: { organizationId: membership.organizationId },
    select: {
      type: true,
      isActive: true,
      lastSyncAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const metricsCount = await db.metric.groupBy({
    by: ["source"],
    where: { organizationId: membership.organizationId },
    _count: true,
  });

  return NextResponse.json({
    integrations: integrations.map((i) => ({
      type: i.type,
      isActive: i.isActive,
      lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
      tokenExpiresAt: i.expiresAt?.toISOString() ?? null,
      connectedAt: i.createdAt.toISOString(),
      metricsCount: metricsCount.find((m) => m.source === i.type)?._count ?? 0,
    })),
  });
}
