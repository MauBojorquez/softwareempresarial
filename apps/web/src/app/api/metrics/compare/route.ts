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

  // Anchor both windows to the first day of a UTC month so they align with the
  // monthly buckets the UI sums by (matching api/metrics/manual). Using
  // setMonth on a day-of-month date overflows on month-ends (e.g. May 31 → "Apr
  // 31" → May 1) and drifts the boundaries; Date.UTC(y, m, 1) avoids that.
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // Current period: the current month plus the previous N-1 months.
  const currentStart = new Date(Date.UTC(y, m - (months - 1), 1));
  // Previous period: the N months immediately before the current window.
  const previousStart = new Date(Date.UTC(y, m - (2 * months - 1), 1));
  const previousEnd = currentStart;

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
