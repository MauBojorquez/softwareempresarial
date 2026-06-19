import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";
import { MetricCategory } from "@prisma/client";

const VALID_CONDITIONS = ["below", "above", "change_pct_down", "change_pct_up"] as const;
type Condition = (typeof VALID_CONDITIONS)[number];

function isValidCategory(v: unknown): v is MetricCategory {
  return typeof v === "string" && Object.values(MetricCategory).includes(v as MetricCategory);
}

function isValidCondition(v: unknown): v is Condition {
  return typeof v === "string" && (VALID_CONDITIONS as readonly string[]).includes(v);
}

async function getMembership(userId: string, orgId: string) {
  return db.membership.findFirst({ where: { userId, organizationId: orgId } });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const rules = await db.alertRule.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      metricName: true,
      category: true,
      condition: true,
      threshold: true,
      isActive: true,
      lastTriggered: true,
      createdAt: true,
      createdById: true,
    },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const membership = await getMembership(session.user.id, orgId);
  if (!membership || membership.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { metricName, category, condition, threshold } = body as Record<string, unknown>;

  if (!metricName || typeof metricName !== "string" || metricName.trim().length === 0) {
    return NextResponse.json({ error: "metricName is required" }, { status: 400 });
  }
  if (!isValidCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!isValidCondition(condition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }
  if (typeof threshold !== "number" || isNaN(threshold) || threshold <= 0) {
    return NextResponse.json({ error: "threshold must be a positive number" }, { status: 400 });
  }

  const rule = await db.alertRule.create({
    data: {
      metricName: metricName.trim(),
      category,
      condition,
      threshold,
      organizationId: orgId,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const membership = await getMembership(session.user.id, orgId);
  if (!membership || membership.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const rule = await db.alertRule.findFirst({ where: { id, organizationId: orgId } });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.alertRule.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
