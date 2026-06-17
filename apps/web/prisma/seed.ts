import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("demo123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@metrixpro.com" },
    update: {},
    create: {
      email: "demo@metrixpro.com",
      name: "Demo User",
      passwordHash: password,
    },
  });

  const org = await prisma.organization.upsert({
    where: { ownerId: user.id },
    update: {},
    create: {
      name: "Demo Company S.A. de C.V.",
      ownerId: user.id,
    },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: { userId: user.id, organizationId: org.id, role: "ADMIN" },
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      interval: "MONTHLY",
      stripeCustomerId: "cus_demo",
      stripeSubscriptionId: "sub_demo",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i));
    d.setDate(1);
    return d;
  });

  const financeMetrics = months.flatMap((period, i) => {
    const base = 450000 + i * 35000 + Math.random() * 20000;
    const expenses = base * (0.55 + Math.random() * 0.05);
    return [
      { organizationId: org.id, category: "FINANCE" as const, name: "income", value: Math.round(base), period, source: "QUICKBOOKS" as const },
      { organizationId: org.id, category: "FINANCE" as const, name: "expenses", value: Math.round(expenses), period, source: "QUICKBOOKS" as const },
      { organizationId: org.id, category: "FINANCE" as const, name: "net_profit", value: Math.round(base - expenses), period, source: "QUICKBOOKS" as const },
      { organizationId: org.id, category: "FINANCE" as const, name: "cash_flow", value: Math.round((base - expenses) * 0.7), period, source: "QUICKBOOKS" as const },
    ];
  });

  const salesMetrics = months.flatMap((period, i) => {
    const pipeline = 5000000 + i * 400000 + Math.random() * 300000;
    const deals = 30 + i * 3 + Math.floor(Math.random() * 5);
    return [
      { organizationId: org.id, category: "SALES" as const, name: "pipeline_value", value: Math.round(pipeline), period, source: "HUBSPOT" as const },
      { organizationId: org.id, category: "SALES" as const, name: "total_deals", value: deals, period, source: "HUBSPOT" as const },
      { organizationId: org.id, category: "SALES" as const, name: "conversion_rate", value: parseFloat((15 + Math.random() * 5).toFixed(1)), unit: "%", period, source: "HUBSPOT" as const },
      { organizationId: org.id, category: "SALES" as const, name: "won_revenue", value: Math.round(pipeline * 0.18), period, source: "HUBSPOT" as const },
      { organizationId: org.id, category: "SALES" as const, name: "avg_deal_size", value: Math.round(pipeline / deals), period, source: "HUBSPOT" as const },
    ];
  });

  const hrMetrics = months.map((period, i) => ({
    organizationId: org.id,
    category: "HR" as const,
    name: "headcount",
    value: 42 + i,
    period,
  }));

  const opsMetrics = months.flatMap((period, i) => [
    { organizationId: org.id, category: "OPERATIONS" as const, name: "efficiency", value: parseFloat((85 + i * 1.5 + Math.random() * 2).toFixed(1)), unit: "%", period },
    { organizationId: org.id, category: "OPERATIONS" as const, name: "on_time_delivery", value: parseFloat((90 + Math.random() * 5).toFixed(1)), unit: "%", period },
  ]);

  const marketingMetrics = months.flatMap((period, i) => [
    { organizationId: org.id, category: "MARKETING" as const, name: "leads", value: 120 + i * 15 + Math.floor(Math.random() * 20), period },
    { organizationId: org.id, category: "MARKETING" as const, name: "cac", value: Math.round(800 - i * 30 + Math.random() * 50), unit: "MXN", period },
    { organizationId: org.id, category: "MARKETING" as const, name: "website_traffic", value: 8000 + i * 1200 + Math.floor(Math.random() * 500), period },
  ]);

  await prisma.metric.deleteMany({ where: { organizationId: org.id } });
  await prisma.metric.createMany({
    data: [...financeMetrics, ...salesMetrics, ...hrMetrics, ...opsMetrics, ...marketingMetrics],
  });

  await prisma.aIReport.deleteMany({ where: { organizationId: org.id } });
  await prisma.aIReport.create({
    data: {
      organizationId: org.id,
      generatedById: user.id,
      title: `Reporte Ejecutivo - ${now.toLocaleString("es-MX", { month: "long", year: "numeric" })}`,
      period: new Date(now.getFullYear(), now.getMonth(), 1),
      status: "COMPLETED",
      summary: "Los ingresos crecieron 10.7% impulsados por 3 deals enterprise cerrados. La utilidad neta mejoró 22% gracias a la optimización de gastos operativos. La tasa de conversión bajó 2.1 puntos y requiere atención inmediata.",
      content: `# Reporte Ejecutivo Mensual\n\n## Resumen Financiero\n- Ingresos: $620,000 MXN (+10.7%)\n- Gastos: $360,000 MXN (+2.9%)\n- Utilidad Neta: $260,000 MXN (+22.4%)\n\n## Ventas\n- Pipeline: $7.4M MXN\n- 45 deals activos\n- Conversión: 17.8% (-2.1pp)\n\n## Recomendaciones\n1. Revisar proceso de calificación de leads para mejorar conversión\n2. Mantener estrategia de deals enterprise\n3. Evaluar expansión del equipo de ventas\n\n## Alertas\n- ⚠️ Conversión por debajo del objetivo (20%)\n- ✅ Ingresos superan proyección trimestral`,
    },
  });

  console.log("Seed completed:");
  console.log(`  User: demo@metrixpro.com / demo123`);
  console.log(`  Org: ${org.name}`);
  console.log(`  Plan: Professional`);
  console.log(`  Metrics: ${financeMetrics.length + salesMetrics.length + hrMetrics.length + opsMetrics.length + marketingMetrics.length} data points`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
