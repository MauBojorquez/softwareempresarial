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
  const months = Math.min(Math.max(parseInt(searchParams.get("months") || "3", 10), 1), 24);

  const validCategories = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }

  const now = new Date();

  // Current period: last N months
  const currentStart = new Date(now);
  currentStart.setMonth(currentStart.getMonth() - months);

  // Previous period: N months before the current period start
  const previousStart = new Date(currentStart);
  previousStart.setMonth(previousStart.getMonth() - months);
  const previousEnd = new Date(currentStart);

  const [current, previous] = await Promise.all([
    db.metric.findMany({
      where: {
        organizationId: membership.organizationId,
        category: category as "FINANCE" | "SALES" | "OPERATIONS" | "HR" | "MARKETING",
        period: { gte: currentStart },
      },
      orderBy: { period: "desc" },
    }),
    db.metric.findMany({
      where: {
        organizationId: membership.organizationId,
        category: category as "FINANCE" | "SALES" | "OPERATIONS" | "HR" | "MARKETING",
        period: { gte: previousStart, lt: previousEnd },
      },
      orderBy: { period: "desc" },
    }),
  ]);

  return NextResponse.json({ current, previous });
}
