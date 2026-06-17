import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: user.organizationId, category: "SALES" },
    orderBy: { period: "desc" },
    take: 10,
  });

  const find = (name: string) => metrics.find((m) => m.name === name);

  return NextResponse.json({
    pipeline: find("pipeline")?.value ?? 7400000,
    activeDeals: find("active_deals")?.value ?? 45,
    conversionRate: find("conversion_rate")?.value ?? 17.8,
    avgDealSize: find("avg_deal_size")?.value ?? 164000,
  });
}
