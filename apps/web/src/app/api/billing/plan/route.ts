import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { PLAN_LIMITS } from "@/server/services/billing/plan-limits";
import type { Plan } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: { include: { subscription: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const sub = membership.organization.subscription;
  if (!sub || !["ACTIVE", "TRIALING"].includes(sub.status)) {
    return NextResponse.json({ plan: null, active: false });
  }

  const limits = PLAN_LIMITS[sub.plan as Plan];

  const [integrationCount, userCount, reportCount] = await Promise.all([
    db.integration.count({ where: { organizationId: membership.organizationId, isActive: true } }),
    db.membership.count({ where: { organizationId: membership.organizationId } }),
    db.aIReport.count({
      where: {
        organizationId: membership.organizationId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  return NextResponse.json({
    plan: sub.plan,
    active: true,
    interval: sub.interval,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
    limits,
    usage: {
      integrations: integrationCount,
      users: userCount,
      aiReportsThisMonth: reportCount,
    },
  });
  } catch {
    return NextResponse.json({ error: "Error loading billing plan" }, { status: 500 });
  }
}
