import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Resolve the membership for the ACTIVE org (respects activeOrgId).
  const orgId = await getOrganizationId(req);
  const membership = orgId
    ? await db.membership.findFirst({ where: { userId: session.user.id, organizationId: orgId } })
    : null;

  if (!membership) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
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
