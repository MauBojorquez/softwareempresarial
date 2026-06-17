import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { period: "desc" },
    take: 20,
  });

  const byCategory = (cat: string) => metrics.find((m) => m.category === cat);

  const revenue = byCategory("FINANCE");
  const sales = byCategory("SALES");
  const hr = byCategory("HR");

  return NextResponse.json({
    revenue: revenue?.value ?? 620000,
    revenueChange: 10.7,
    pipeline: sales?.value ?? 7400000,
    pipelineChange: 5.2,
    employees: hr?.value ?? 48,
    employeesChange: 4.3,
    conversion: 17.8,
    conversionChange: -2.1,
  });
}
