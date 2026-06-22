import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrganizationId(req);
    if (!orgId) return NextResponse.json({ categories: [] });
    const categories = await db.cashFlowCategory.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ categories });
  } catch (err) {
    console.error("cashflow/categories GET error:", err);
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrganizationId(req);
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 401 });
    const body = await req.json();
    if (!body?.code || !body?.name) {
      return NextResponse.json({ error: "Code and name required" }, { status: 400 });
    }
    const count = await db.cashFlowCategory.count({ where: { organizationId: orgId } });
    const cat = await db.cashFlowCategory.create({
      data: {
        organizationId: orgId,
        code: String(body.code).toUpperCase(),
        name: String(body.name),
        type: body.type ?? "both",
        order: count,
      },
    });
    return NextResponse.json({ category: cat });
  } catch (err) {
    console.error("cashflow/categories POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
