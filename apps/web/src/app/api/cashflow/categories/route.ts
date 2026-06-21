import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const categories = await db.cashFlowCategory.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: [{ type: "asc" }, { order: "asc" }],
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { code, name, type } = body;
  if (!code || !name || !type) return NextResponse.json({ error: "code, name, type are required" }, { status: 400 });
  if (!["income", "expense"].includes(type)) return NextResponse.json({ error: "type must be income or expense" }, { status: 400 });

  const count = await db.cashFlowCategory.count({ where: { organizationId: membership.organizationId, type } });

  const category = await db.cashFlowCategory.create({
    data: {
      code,
      name,
      type,
      order: count,
      organizationId: membership.organizationId,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}
