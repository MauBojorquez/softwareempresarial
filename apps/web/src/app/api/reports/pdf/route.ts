import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") || "report";

  if (type === "report" && id) {
    const report = await db.aIReport.findFirst({
      where: { id, organizationId: membership.organizationId },
    });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const html = buildReportHTML(report.title, report.summary, report.content, report.createdAt);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.title.replace(/[^a-zA-Z0-9áéíóúñ ]/g, "")}.html"`,
      },
    });
  }

  if (type === "metrics") {
    const metrics = await db.metric.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { period: "desc" },
      take: 200,
    });

    const org = await db.organization.findUnique({ where: { id: membership.organizationId } });
    const html = buildMetricsHTML(org?.name || "Mi Empresa", metrics);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="Metricas-${new Date().toISOString().split("T")[0]}.html"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildReportHTML(title: string, summary: string, content: string, date: Date) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 24px; border-bottom: 2px solid #2563a8; padding-bottom: 12px; color: #2563a8; }
  h2 { font-size: 18px; color: #334155; margin-top: 24px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .summary { background: #f0f4ff; border-left: 4px solid #2563a8; padding: 16px; border-radius: 4px; margin: 16px 0; }
  .content { white-space: pre-line; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="meta">Generado el ${date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} | StratiuMetrics</p>
  <div class="summary">
    <h2>Resumen Ejecutivo</h2>
    <p>${esc(summary).replace(/\n/g, "<br>")}</p>
  </div>
  <div class="content">
    <h2>Análisis Detallado</h2>
    ${esc(content).replace(/\n/g, "<br>")}
  </div>
  <div class="footer">
    <p>Este reporte fue generado automáticamente por StratiuMetrics. Los datos reflejan la información disponible al momento de la generación.</p>
  </div>
</body>
</html>`;
}

function buildMetricsHTML(orgName: string, metrics: Array<{ name: string; value: number; unit: string | null; category: string; period: Date }>) {
  const byCategory: Record<string, typeof metrics> = {};
  for (const m of metrics) {
    if (m.name.startsWith("META_") || m.name.startsWith("meta_")) continue;
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }

  const categoryNames: Record<string, string> = {
    FINANCE: "Finanzas", SALES: "Ventas", OPERATIONS: "Operaciones", HR: "Recursos Humanos", MARKETING: "Marketing",
  };

  const rows = Object.entries(byCategory).map(([cat, items]) => {
    const tableRows = items.map((m) =>
      `<tr><td>${esc(m.name)}</td><td style="text-align:right">${m.unit === "MXN" ? "$" + m.value.toLocaleString("es-MX") : m.value.toLocaleString("es-MX") + " " + esc(m.unit || "")}</td><td>${m.period.toLocaleDateString("es-MX")}</td></tr>`
    ).join("");
    return `<h2>${categoryNames[cat] || cat}</h2><table>${tableRows}</table>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Métricas - ${esc(orgName)}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 24px; border-bottom: 2px solid #2563a8; padding-bottom: 12px; color: #2563a8; }
  h2 { font-size: 16px; color: #334155; margin-top: 24px; background: #f8fafc; padding: 8px 12px; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  tr:hover { background: #f8fafc; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Reporte de Métricas — ${esc(orgName)}</h1>
  <p style="color:#64748b;font-size:13px;">Generado el ${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
  ${rows}
  <div class="footer">
    <p>StratiuMetrics | Reporte generado automáticamente</p>
  </div>
</body>
</html>`;
}
