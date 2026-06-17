import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";

const anthropic = new Anthropic();

export async function generateMonthlyReport(organizationId: string, userId: string) {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { subscription: true },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const metrics = await db.metric.findMany({
    where: {
      organizationId,
      period: { gte: startOfMonth, lte: now },
    },
    orderBy: { period: "asc" },
  });

  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const previousMetrics = await db.metric.findMany({
    where: {
      organizationId,
      period: { gte: previousMonth, lte: endOfPreviousMonth },
    },
  });

  const metricsSummary = buildMetricsSummary(metrics);
  const previousSummary = buildMetricsSummary(previousMetrics);

  const report = await db.aIReport.create({
    data: {
      organizationId,
      generatedById: userId,
      title: `Reporte Mensual - ${now.toLocaleString("es-MX", { month: "long", year: "numeric" })}`,
      content: "",
      summary: "",
      period: startOfMonth,
      type: "MONTHLY",
      status: "GENERATING",
    },
  });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6-20250620",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Eres un consultor de negocios experto. Genera un reporte ejecutivo mensual en español para la empresa "${org.name}" (industria: ${org.industry ?? "general"}).

## Métricas del mes actual:
${JSON.stringify(metricsSummary, null, 2)}

## Métricas del mes anterior (para comparación):
${JSON.stringify(previousSummary, null, 2)}

Genera un reporte con las siguientes secciones:
1. **Resumen Ejecutivo** (3-4 oraciones con los highlights)
2. **Finanzas** - Análisis de ingresos, gastos, márgenes
3. **Ventas** - Pipeline, conversiones, tendencias
4. **Operaciones** - Eficiencia y productividad
5. **Recursos Humanos** - Headcount, rotación
6. **Marketing** - Leads, CAC, ROI
7. **Recomendaciones** - 3-5 acciones concretas con prioridad
8. **Alertas** - Métricas que requieren atención inmediata

Usa datos concretos, porcentajes de cambio vs mes anterior, y lenguaje ejecutivo directo. Formato Markdown.`,
        },
      ],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    const summary = content.split("\n").slice(0, 5).join("\n");

    await db.aIReport.update({
      where: { id: report.id },
      data: { content, summary, status: "COMPLETED" },
    });

    return report.id;
  } catch (error) {
    await db.aIReport.update({
      where: { id: report.id },
      data: { status: "FAILED", content: String(error) },
    });
    throw error;
  }
}

function buildMetricsSummary(metrics: Array<{ category: string; name: string; value: number; unit: string | null }>) {
  const summary: Record<string, Record<string, { value: number; unit: string | null }>> = {};
  for (const m of metrics) {
    if (!summary[m.category]) summary[m.category] = {};
    summary[m.category][m.name] = { value: m.value, unit: m.unit };
  }
  return summary;
}
