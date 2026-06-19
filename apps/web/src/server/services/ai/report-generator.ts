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

  const hasData = Object.keys(metricsSummary).length > 0;
  const sectionList = Object.keys(metricsSummary).join(", ") || "ninguna";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Eres un consultor de negocios senior. Genera un reporte ejecutivo mensual en español para la empresa "${org.name}" (industria: ${org.industry ?? "general"}).

INSTRUCCIONES ESTRICTAS DE FORMATO:
- Escribe en prosa profesional, estilo documento corporativo impreso
- NO uses markdown: cero asteriscos (*), cero almohadillas (#), cero guiones de lista (-)
- Los títulos de sección van en MAYÚSCULAS seguidos de dos puntos, en su propia línea
- Usa solo datos que aparezcan explícitamente en las métricas proporcionadas
- Si una categoría no tiene datos, escribe una sola línea: "Sin datos disponibles para este período."
- Las categorías con datos son: ${sectionList}
${!hasData ? "- IMPORTANTE: No hay métricas registradas. Indica esto claramente en cada sección y sugiere cómo empezar a registrar datos." : ""}

ESTRUCTURA DEL REPORTE:

RESUMEN EJECUTIVO:
[3 a 4 oraciones. Los resultados más importantes del período, con cifras concretas si están disponibles.]

FINANZAS:
[Ingresos, egresos, márgenes, comparativa vs mes anterior. Solo si hay datos de la categoría FINANCE.]

VENTAS Y CRM:
[Pipeline, conversiones, deals, tendencias. Solo si hay datos de la categoría SALES.]

OPERACIONES:
[Eficiencia, productividad. Solo si hay datos de OPERATIONS.]

RECURSOS HUMANOS:
[Headcount, nómina, rotación. Solo si hay datos de HR.]

MARKETING:
[Inversión publicitaria, alcance, conversiones digitales. Solo si hay datos de MARKETING.]

RECOMENDACIONES:
[3 a 5 acciones concretas con prioridad, basadas únicamente en los datos disponibles.]

ALERTAS:
[Métricas que requieren atención inmediata. Si todo está bien, indicarlo.]

MÉTRICAS DEL MES ACTUAL:
${JSON.stringify(metricsSummary, null, 2)}

MÉTRICAS DEL MES ANTERIOR (referencia):
${JSON.stringify(previousSummary, null, 2)}`,
        },
      ],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract the executive summary: everything between "RESUMEN EJECUTIVO:" and the next section.
    const summaryMatch = content.match(/RESUMEN EJECUTIVO:\s*([\s\S]*?)(?=\n[A-ZÁÉÍÓÚÑ ]{3,}:|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : content.slice(0, 400).trim();

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
