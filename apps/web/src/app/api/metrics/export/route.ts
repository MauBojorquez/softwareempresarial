import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export const runtime = "nodejs";

const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finanzas",
  SALES: "Ventas",
  OPERATIONS: "Operaciones",
  HR: "Recursos Humanos",
  MARKETING: "Marketing",
};

// GET /api/metrics/export?format=csv|xlsx&category=FINANCE (category optional)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const categoryFilter = searchParams.get("category");

  const validCategories = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];
  const whereCategory = categoryFilter && validCategories.includes(categoryFilter)
    ? (categoryFilter as any)
    : undefined;

  const metrics = await db.metric.findMany({
    where: {
      organizationId: orgId,
      name: { not: { startsWith: "META_" } },
      ...(whereCategory ? { category: whereCategory } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }, { period: "desc" }],
  });

  const date = new Date().toISOString().split("T")[0];

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const rows = metrics.map((m) => ({
      Categoría: CATEGORY_LABELS[m.category] ?? m.category,
      Métrica: m.name,
      Valor: m.value,
      Unidad: m.unit ?? "",
      Fecha: m.period.toISOString().split("T")[0],
      Fuente: m.source ?? "manual",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Métricas");

    // Summary sheet per category
    const categories = [...new Set(metrics.map((m) => m.category))];
    for (const cat of categories) {
      const catMetrics = metrics.filter((m) => m.category === cat);
      const catRows = catMetrics.map((m) => ({
        Métrica: m.name,
        Valor: m.value,
        Unidad: m.unit ?? "",
        Fecha: m.period.toISOString().split("T")[0],
        Fuente: m.source ?? "manual",
      }));
      const catWs = XLSX.utils.json_to_sheet(catRows);
      catWs["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, catWs, CATEGORY_LABELS[cat] ?? cat);
    }

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=metrixpro_${date}.xlsx`,
      },
    });
  }

  // CSV fallback
  const header = "categoria,metrica,valor,unidad,fecha,fuente";
  const rows = metrics.map((m) =>
    [
      m.category,
      `"${m.name.replace(/"/g, '""')}"`,
      m.value,
      m.unit ?? "",
      m.period.toISOString().split("T")[0],
      m.source ?? "manual",
    ].join(","),
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=metrixpro_${date}.csv`,
    },
  });
}
