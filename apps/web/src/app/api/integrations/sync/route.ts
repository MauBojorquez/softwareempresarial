import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { syncMetaAdsMetrics } from "@/server/services/integrations/meta-ads";

export async function POST(req: NextRequest) {
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

  const { type } = (await req.json()) as { type?: "META_ADS" | "ALL" };
  const orgId = membership.organizationId;
  const results: Record<string, { success: boolean; error?: string; metricsCount?: number }> = {};

  const syncMetaAds = async () => {
    try {
      const metricsCount = await syncMetaAdsMetrics(orgId);
      results.meta_ads = { success: true, metricsCount };
    } catch (e: any) {
      results.meta_ads = { success: false, error: e.message };
    }
  };

  if (type === "META_ADS") {
    await syncMetaAds();
  } else {
    await Promise.allSettled([syncMetaAds()]);
  }

  const successTypes = Object.entries(results)
    .filter(([, v]) => v.success)
    .map(([k]) => k.toUpperCase());

  if (successTypes.length > 0) {
    await db.integration.updateMany({
      where: {
        organizationId: orgId,
        type: { in: successTypes as any },
      },
      data: { lastSyncAt: new Date() },
    });

    const totalMetrics = Object.values(results).reduce((s, r) => s + (r.metricsCount || 0), 0);
    try {
      await db.notification.create({
        data: {
          userId: session.user.id,
          title: "Sincronización completada",
          message: `${totalMetrics} métricas sincronizadas de ${successTypes.length} integración(es).`,
          type: "sync",
        },
      });
    } catch {}
  }

  return NextResponse.json({ results, syncedAt: new Date().toISOString() });
}
