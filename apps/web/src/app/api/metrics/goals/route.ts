import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const metrics = await db.metric.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { period: "desc" },
  });

  const latest = (name: string) => metrics.find((m) => m.name === name);

  // Conversión is derived from leads/deals, not stored directly.
  const leads = latest("Nuevos Leads")?.value ?? 0;
  const deals = latest("Deals Cerrados")?.value ?? 0;
  const conversion = leads > 0 ? parseFloat(((deals / leads) * 100).toFixed(1)) : 0;

  const unique = new Map<string, (typeof metrics)[number]>();
  for (const g of metrics) {
    if (g.name.startsWith("META_") && !unique.has(g.name)) unique.set(g.name, g);
  }

  const goals = Array.from(unique.values()).map((g) => {
    const metricName = g.name.replace("META_", "");
    const cur = metricName === "Conversión" ? { value: conversion, unit: "%" } : latest(metricName);
    return {
      name: metricName,
      target: g.value,
      unit: cur?.unit || g.unit || "",
      current: cur?.value ?? 0,
    };
  });

  return NextResponse.json({ goals });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const metric = req.nextUrl.searchParams.get("metric");
  if (!metric) return NextResponse.json({ error: "metric required" }, { status: 400 });

  await db.metric.deleteMany({
    where: { organizationId: membership.organizationId, name: `META_${metric}` },
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { metric, target, unit } = body;

  if (!metric || typeof target !== "number" || target < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const name = `META_${metric}`;
  const existing = await db.metric.findFirst({
    where: { organizationId: membership.organizationId, name },
    orderBy: { period: "desc" },
  });

  if (existing) {
    await db.metric.update({ where: { id: existing.id }, data: { value: target, unit: unit || existing.unit } });
  } else {
    await db.metric.create({
      data: {
        organizationId: membership.organizationId,
        category: "FINANCE",
        name,
        value: target,
        unit: unit || "meta",
        period: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true });
}
