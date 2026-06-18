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
    return NextResponse.json({ error: "No organization" }, { status: 404 });
  }

  const integration = await db.integration.findFirst({
    where: { organizationId: membership.organizationId, type: "META_ADS", isActive: true },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [currentMetrics, previousMetrics] = await Promise.all([
    db.metric.findMany({
      where: {
        organizationId: membership.organizationId,
        source: "META_ADS",
        period: { gte: firstOfMonth },
      },
    }),
    db.metric.findMany({
      where: {
        organizationId: membership.organizationId,
        source: "META_ADS",
        period: { gte: lastMonth, lt: firstOfMonth },
      },
    }),
  ]);

  const getValue = (metrics: any[], name: string) =>
    metrics.find((m) => m.name === name)?.value ?? 0;

  const current = {
    spend: getValue(currentMetrics, "meta_spend"),
    impressions: getValue(currentMetrics, "meta_impressions"),
    clicks: getValue(currentMetrics, "meta_clicks"),
    ctr: getValue(currentMetrics, "meta_ctr"),
    cpc: getValue(currentMetrics, "meta_cpc"),
    cpm: getValue(currentMetrics, "meta_cpm"),
    reach: getValue(currentMetrics, "meta_reach"),
    conversions: getValue(currentMetrics, "meta_conversions"),
    roas: getValue(currentMetrics, "meta_roas"),
  };

  const previous = {
    spend: getValue(previousMetrics, "meta_spend"),
    clicks: getValue(previousMetrics, "meta_clicks"),
    ctr: getValue(previousMetrics, "meta_ctr"),
    roas: getValue(previousMetrics, "meta_roas"),
  };

  const calcChange = (curr: number, prev: number) =>
    prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(1)) : null;

  return NextResponse.json({
    connected: true,
    current,
    changes: {
      spend: calcChange(current.spend, previous.spend),
      clicks: calcChange(current.clicks, previous.clicks),
      ctr: calcChange(current.ctr, previous.ctr),
      roas: calcChange(current.roas, previous.roas),
    },
  });
}
