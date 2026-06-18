import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
  const reports = await db.aIReport.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      content: r.content,
      period: r.period.toISOString(),
      type: r.type,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
  } catch {
    return NextResponse.json({ error: "Error loading reports" }, { status: 500 });
  }
}
