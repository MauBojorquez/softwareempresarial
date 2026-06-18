import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const goals = await db.metric.findMany({
    where: { organizationId: membership.organizationId, name: { startsWith: "META_" } },
    orderBy: { period: "desc" },
  });

  const parsed: Record<string, number> = {};
  for (const g of goals) {
    const key = g.name.replace("META_", "");
    if (!parsed[key]) parsed[key] = g.value;
  }

  return NextResponse.json({ goals: parsed });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { metric, target } = body;

  if (!metric || typeof target !== "number" || target < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const name = `META_${metric}`;
  const existing = await db.metric.findFirst({
    where: { organizationId: membership.organizationId, name },
    orderBy: { period: "desc" },
  });

  if (existing) {
    await db.metric.update({ where: { id: existing.id }, data: { value: target } });
  } else {
    await db.metric.create({
      data: {
        organizationId: membership.organizationId,
        category: "FINANCE",
        name,
        value: target,
        unit: "meta",
        period: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true });
}
