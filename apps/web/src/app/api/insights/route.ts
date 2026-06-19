import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { detectAnomalies } from "@/server/services/metrics/insights";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const anomalies = await detectAnomalies(orgId);
    return NextResponse.json({ anomalies });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ anomalies: [] });
  }
}
