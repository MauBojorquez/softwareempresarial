import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { activeOrgId: true } });
  return user?.activeOrgId ?? null;
}

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const categories = await db.cashFlowCategory.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const count = await db.cashFlowCategory.count({ where: { organizationId: orgId } });
  const cat = await db.cashFlowCategory.create({
    data: { organizationId: orgId, code: body.code.toUpperCase(), name: body.name, type: body.type ?? "both", order: count },
  });
  return NextResponse.json({ category: cat });
}
