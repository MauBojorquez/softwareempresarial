import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const metrics = await db.metric.findMany({
    where: { organizationId: membership.organizationId, name: { not: { startsWith: "META_" } } },
    orderBy: [{ category: "asc" }, { period: "desc" }],
  });

  const header = "categoria,metrica,valor,unidad,fecha,fuente";
  const rows = metrics.map((m) =>
    `${m.category},${m.name},${m.value},${m.unit || ""},${m.period.toISOString().split("T")[0]},${m.source || "manual"}`
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=metrixpro_export_${new Date().toISOString().split("T")[0]}.csv`,
    },
  });
}
