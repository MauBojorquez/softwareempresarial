import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: orgId },
    orderBy: { period: "desc" },
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const latest = (name: string) => metrics.find((m) => m.name === name);
  const previous = (name: string) => metrics.filter((m) => m.name === name)[1];
  const allValues = (name: string) => metrics.filter((m) => m.name === name);

  const calc = (name: string) => {
    const curr = latest(name);
    const prev = previous(name);
    const value = curr?.value ?? 0;
    const change = prev && prev.value !== 0 ? ((value - prev.value) / prev.value) * 100 : 0;
    return { value, change: parseFloat(change.toFixed(1)) };
  };

  const revenue = calc("Ingresos");
  const gastos = calc("Gastos");
  const pipeline = calc("Pipeline Total");
  const headcount = calc("Headcount");
  const nomina = calc("Costo Nómina");

  const leads = latest("Nuevos Leads")?.value ?? 0;
  const deals = latest("Deals Cerrados")?.value ?? 0;
  const conversion = leads > 0 ? parseFloat(((deals / leads) * 100).toFixed(1)) : 0;

  const prevLeads = previous("Nuevos Leads")?.value ?? 0;
  const prevDeals = previous("Deals Cerrados")?.value ?? 0;
  const prevConversion = prevLeads > 0 ? (prevDeals / prevLeads) * 100 : 0;
  const conversionChange = prevConversion > 0 ? parseFloat(((conversion - prevConversion) / prevConversion * 100).toFixed(1)) : 0;

  const ytdRevenue = allValues("Ingresos")
    .filter((m) => m.period.getFullYear() === currentYear)
    .reduce((sum, m) => sum + m.value, 0);

  const ytdGastos = allValues("Gastos")
    .filter((m) => m.period.getFullYear() === currentYear)
    .reduce((sum, m) => sum + m.value, 0);

  const annualProjection = currentMonth > 0 ? (ytdRevenue / (currentMonth + 1)) * 12 : ytdRevenue * 12;
  const revenuePerEmployee = headcount.value > 0 ? revenue.value / headcount.value : 0;
  const utilidad = revenue.value - gastos.value;
  const margen = revenue.value > 0 ? (utilidad / revenue.value) * 100 : 0;

  const monthlyHistory: { month: string; ingresos: number; gastos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(currentYear, currentMonth - i, 1);
    const monthName = m.toLocaleDateString("es-MX", { month: "short" });
    const ing = allValues("Ingresos").find(
      (v) => v.period.getMonth() === m.getMonth() && v.period.getFullYear() === m.getFullYear()
    )?.value ?? 0;
    const gas = allValues("Gastos").find(
      (v) => v.period.getMonth() === m.getMonth() && v.period.getFullYear() === m.getFullYear()
    )?.value ?? 0;
    monthlyHistory.push({ month: monthName, ingresos: ing, gastos: gas });
  }

  const goals = await db.metric.findMany({
    where: { organizationId: orgId, name: { startsWith: "META_" } },
    orderBy: { period: "desc" },
  });

  const getGoal = (name: string) => goals.find((g) => g.name === `META_${name}`)?.value ?? 0;

  const metaIntegration = await db.integration.findFirst({
    where: { organizationId: orgId, type: "META_ADS", isActive: true },
  });

  let metaSummary = null;
  if (metaIntegration) {
    const metaMetrics = await db.metric.findMany({
      where: { organizationId: orgId, source: "META_ADS" },
      orderBy: { period: "desc" },
      take: 20,
    });
    const metaVal = (name: string) => metaMetrics.find((m) => m.name === name)?.value ?? 0;
    metaSummary = {
      spend: metaVal("meta_spend"),
      clicks: metaVal("meta_clicks"),
      impressions: metaVal("meta_impressions"),
      reach: metaVal("meta_reach"),
    };
  }

  return NextResponse.json({
    revenue: revenue.value,
    revenueChange: revenue.change,
    gastos: gastos.value,
    gastosChange: gastos.change,
    pipeline: pipeline.value,
    pipelineChange: pipeline.change,
    employees: headcount.value,
    employeesChange: headcount.change,
    conversion,
    conversionChange,
    nomina: nomina.value,
    hasData: metrics.length > 0,
    calculated: {
      ytdRevenue,
      ytdGastos,
      annualProjection,
      revenuePerEmployee: parseFloat(revenuePerEmployee.toFixed(0)),
      utilidad,
      margen: parseFloat(margen.toFixed(1)),
    },
    goals: {
      revenue: getGoal("Ingresos"),
      gastos: getGoal("Gastos"),
      pipeline: getGoal("Pipeline Total"),
      employees: getGoal("Headcount"),
    },
    monthlyHistory,
    metaSummary,
    metaConnected: !!metaIntegration,
  });
}
