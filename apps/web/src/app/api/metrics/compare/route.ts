import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { currentMonthMX, shiftMonth } from "@/lib/day";
import { isMetricCategory, metricResource } from "@/server/services/metrics/access";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const monthsRaw = parseInt(searchParams.get("months") || "3", 10);
  const months = Number.isFinite(monthsRaw) ? Math.min(Math.max(monthsRaw, 1), 24) : 3;

  if (!isMetricCategory(category)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }

  const access = await requireAccess(req, metricResource(category));
  if (access instanceof NextResponse) return access;
  const membership = { organizationId: access.orgId };

  // "Current month" is the business (America/Mexico_City) month. Metric rows
  // are bucketed by their UTC month string (manual rows are stored at
  // UTC-midnight day 1, matching api/metrics/manual), so each window starts at
  // UTC midnight of day 1 of its month.
  const monthStart = (mes: string) => new Date(`${mes}-01T00:00:00.000Z`);
  const mes = currentMonthMX();
  // Current period: the current month plus the previous N-1 months.
  const currentStart = monthStart(shiftMonth(mes, -(months - 1)));
  // Previous period: the N months immediately before the current window.
  const previousStart = monthStart(shiftMonth(mes, -(2 * months - 1)));
  const previousEnd = currentStart;

  const [current, previous] = await Promise.all([
    db.metric.findMany({
      where: {
        organizationId: membership.organizationId,
        category,
        period: { gte: currentStart },
      },
      orderBy: { period: "desc" },
    }),
    db.metric.findMany({
      where: {
        organizationId: membership.organizationId,
        category,
        period: { gte: previousStart, lt: previousEnd },
      },
      orderBy: { period: "desc" },
    }),
  ]);

  return NextResponse.json({ current, previous });
}
