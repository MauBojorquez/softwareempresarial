import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: orgId, category: "SALES" },
    orderBy: { period: "desc" },
    take: 30,
  });

  const latest = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;

  return NextResponse.json({
    pipeline: latest("pipeline_value"),
    activeDeals: latest("total_deals"),
    conversionRate: latest("conversion_rate"),
    avgDealSize: latest("avg_deal_size"),
  });
}
