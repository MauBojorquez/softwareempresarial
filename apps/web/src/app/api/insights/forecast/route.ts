import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { forecastHeadline, forecastMetric } from "@/server/services/metrics/insights";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metric = req.nextUrl.searchParams.get("metric");
  try {
    if (metric) {
      const series = await forecastMetric(orgId, metric);
      return NextResponse.json({ forecasts: series ? [series] : [] });
    }
    const forecasts = await forecastHeadline(orgId);
    return NextResponse.json({ forecasts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ forecasts: [] });
  }
}
