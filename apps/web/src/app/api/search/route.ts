import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ results: [] });
  }

  const orgId = membership.organizationId;

  const [metrics, reports] = await Promise.all([
    db.metric.findMany({
      where: {
        organizationId: orgId,
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { period: "desc" },
      take: 8,
      select: { id: true, name: true, value: true, unit: true, category: true, period: true },
    }),
    db.aIReport.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const categoryMap: Record<string, string> = {
    FINANCE: "/dashboard/finance",
    SALES: "/dashboard/sales",
    OPERATIONS: "/dashboard/operations",
    HR: "/dashboard/hr",
    MARKETING: "/dashboard/marketing",
  };

  const results = [
    ...metrics.map((m) => ({
      type: "metric" as const,
      id: m.id,
      title: m.name,
      subtitle: `${m.value} ${m.unit || ""} — ${new Date(m.period).toLocaleDateString("es-MX")}`,
      href: categoryMap[m.category] || "/dashboard/overview",
      category: m.category,
    })),
    ...reports.map((r) => ({
      type: "report" as const,
      id: r.id,
      title: r.title,
      subtitle: new Date(r.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
      href: "/dashboard/reports",
      category: "REPORTS",
    })),
  ];

  return NextResponse.json({ results });
}
