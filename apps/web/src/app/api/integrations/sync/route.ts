import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { syncFinancialMetrics } from "@/server/services/integrations/quickbooks";
import { syncSalesMetrics } from "@/server/services/integrations/hubspot";
import { syncMetaAdsMetrics } from "@/server/services/integrations/meta-ads";
import { ensureValidToken } from "@/server/services/integrations/token-refresh";

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

  const { type } = (await req.json()) as { type?: "QUICKBOOKS" | "HUBSPOT" | "META_ADS" | "ALL" };
  const orgId = membership.organizationId;
  const results: Record<string, { success: boolean; error?: string; metricsCount?: number }> = {};

  const syncQuickBooks = async () => {
    try {
      await ensureValidToken(orgId, "QUICKBOOKS");
      await syncFinancialMetrics(orgId);
      const count = await db.metric.count({
        where: { organizationId: orgId, source: "QUICKBOOKS" },
      });
      results.quickbooks = { success: true, metricsCount: count };
    } catch (e: any) {
      results.quickbooks = { success: false, error: e.message };
    }
  };

  const syncHubSpot = async () => {
    try {
      await ensureValidToken(orgId, "HUBSPOT");
      await syncSalesMetrics(orgId);
      const count = await db.metric.count({
        where: { organizationId: orgId, source: "HUBSPOT" },
      });
      results.hubspot = { success: true, metricsCount: count };
    } catch (e: any) {
      results.hubspot = { success: false, error: e.message };
    }
  };

  const syncMetaAds = async () => {
    try {
      const metricsCount = await syncMetaAdsMetrics(orgId);
      results.meta_ads = { success: true, metricsCount };
    } catch (e: any) {
      results.meta_ads = { success: false, error: e.message };
    }
  };

  if (type === "QUICKBOOKS") {
    await syncQuickBooks();
  } else if (type === "HUBSPOT") {
    await syncHubSpot();
  } else if (type === "META_ADS") {
    await syncMetaAds();
  } else {
    await Promise.allSettled([syncQuickBooks(), syncHubSpot(), syncMetaAds()]);
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
  }

  return NextResponse.json({ results, syncedAt: new Date().toISOString() });
}
