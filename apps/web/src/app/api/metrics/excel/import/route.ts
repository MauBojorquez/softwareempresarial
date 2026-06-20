import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { logActivity } from "@/lib/activity";
import { ALL_CATEGORIES, CATEGORY_SECTION, type MetricCategoryKey } from "@/lib/metric-templates";

type Entry = { name: string; value: number | string; unit?: string; period?: string };

const MAX_ENTRIES = 5000;

/**
 * POST /api/metrics/excel/import
 * Bulk-inserts mapped metric entries coming from the Excel mapping wizard.
 * Body: { category, entries: [{ name, value, unit, period }] }
 * Permissions: ADMIN or EDITOR with access to the target section.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host.split(":")[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  // Viewers cannot import.
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "No tienes permiso para importar datos" }, { status: 403 });
  }

  const { category, entries } = (await req.json()) as { category: MetricCategoryKey; entries: Entry[] };

  if (!category || !ALL_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  // Editors must have the section in their allowedSections (empty = full access).
  if (membership.role === "EDITOR" && membership.allowedSections.length > 0) {
    const section = CATEGORY_SECTION[category];
    if (!membership.allowedSections.includes(section)) {
      return NextResponse.json({ error: "No tienes acceso a esta sección" }, { status: 403 });
    }
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No hay datos para importar" }, { status: 400 });
  }
  if (entries.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `Máximo ${MAX_ENTRIES} filas por importación` }, { status: 400 });
  }

  const valid: { category: MetricCategoryKey; name: string; value: number; unit: string | null; period: Date; organizationId: string }[] = [];
  let skipped = 0;

  for (const e of entries) {
    const name = typeof e.name === "string" ? e.name.trim().slice(0, 100) : "";
    const value = typeof e.value === "number" ? e.value : parseFloat(String(e.value).replace(/[$,\s]/g, ""));
    if (!name || !Number.isFinite(value)) { skipped++; continue; }

    let period = e.period ? new Date(e.period) : new Date();
    if (isNaN(period.getTime())) period = new Date();

    valid.push({
      category,
      name,
      value,
      unit: e.unit?.slice(0, 20) || null,
      period,
      organizationId: membership.organizationId,
    });
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "Ninguna fila tenía datos válidos. Revisa el mapeo." }, { status: 400 });
  }

  await db.metric.createMany({ data: valid });

  logActivity({
    userId: session.user.id,
    organizationId: membership.organizationId,
    action: "metric.create",
    detail: `Importación Excel: ${valid.length} registros en ${category}`,
  });

  return NextResponse.json({ imported: valid.length, skipped });
}
