import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const months = parseInt(searchParams.get("months") || "1", 10);

  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const metrics = await db.metric.findMany({
    where: {
      organizationId: membership.organizationId,
      category: category as any,
      period: { gte: since },
    },
    orderBy: { period: "desc" },
  });

  return NextResponse.json({ metrics });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { category, name, value, unit, period } = body;

  if (!category || !name || value === undefined) {
    return NextResponse.json({ error: "category, name, and value are required" }, { status: 400 });
  }

  const metric = await db.metric.create({
    data: {
      category,
      name,
      value,
      unit: unit || null,
      period: period ? new Date(period) : new Date(),
      source: null,
      organizationId: membership.organizationId,
    },
  });

  return NextResponse.json({ metric }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const metric = await db.metric.findFirst({
    where: { id, organizationId: membership.organizationId },
  });

  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  await db.metric.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
