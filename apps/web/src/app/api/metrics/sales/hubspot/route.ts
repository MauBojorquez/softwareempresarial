import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

/**
 * Returns the latest HubSpot snapshot from integration.metadata.
 * No live HubSpot API calls — the sync job populates the snapshot.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 404 });

  const { organizationId } = membership;

  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });

  if (!integration?.isActive) return NextResponse.json({ connected: false });

  const meta = integration.metadata as any;

  // If no snapshot yet (first connect before first sync), return empty state
  if (!meta?.syncedAt) {
    return NextResponse.json({
      connected: true,
      needsSync: true,
      contacts: { total: 0, newThisMonth: 0, byStage: [] },
      pipeline: { stages: [], total: 0, closedWon: { count: 0, amount: 0 }, closedLost: { count: 0 } },
      lastSyncAt: null,
    });
  }

  return NextResponse.json({
    connected: true,
    contacts: meta.contacts,
    pipeline: meta.pipeline,
    lastSyncAt: meta.syncedAt,
  });
}
