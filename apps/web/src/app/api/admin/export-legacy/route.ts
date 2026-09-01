import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY, read-only backup endpoint (Fase 0).
 *
 * Dumps the legacy tables that are about to be removed (Subscription,
 * SatCredential, SatDownloadRequest, ApiKey) as a downloadable JSON file so
 * Dirección can keep a copy before the tables are dropped.
 *
 * Access: ADMIN membership only. Scoped to the caller's own organization.
 * This route (and the models) are deleted right after the backup is approved.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo Dirección puede exportar" }, { status: 403 });
  }

  const orgId = membership.organizationId;

  const [subscriptions, satCredentials, satDownloadRequests, apiKeys] = await Promise.all([
    db.subscription.findMany({ where: { organizationId: orgId } }),
    db.satCredential.findMany({ where: { organizationId: orgId } }),
    db.satDownloadRequest.findMany({ where: { organizationId: orgId } }),
    db.apiKey.findMany({ where: { organizationId: orgId } }),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    organizationId: orgId,
    note: "Respaldo previo al borrado de tablas legacy (Fase 0). Solo-lectura.",
    counts: {
      subscriptions: subscriptions.length,
      satCredentials: satCredentials.length,
      satDownloadRequests: satDownloadRequests.length,
      apiKeys: apiKeys.length,
    },
    data: { subscriptions, satCredentials, satDownloadRequests, apiKeys },
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="stratiumetrics-backup-legacy-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
