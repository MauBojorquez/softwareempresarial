import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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

    // ── Finanzas Fiscales SAT ──────────────────────────────
    const satCredential = await db.satCredential.findUnique({ where: { organizationId: orgId } });
    const satConnected = !!satCredential;

    // SAT metrics use source="SAT"
    const satMetrics = metrics.filter((m) => m.source === "SAT");
    const satLatest = (name: string) => satMetrics.find((m) => m.name === name);
    const satPrev = (name: string) => satMetrics.filter((m) => m.name === name)[1];

    const satCalc = (name: string) => {
      const curr = satLatest(name);
      const prev = satPrev(name);
      const value = curr?.value ?? 0;
      const change = prev && prev.value !== 0 ? ((value - prev.value) / prev.value) * 100 : 0;
      return { value, change: parseFloat(change.toFixed(1)) };
    };

    // Fall back to generic metrics when SAT not connected yet
    const satIngresos = satConnected ? satCalc("Ingresos SAT") : calc("Ingresos");
    const satEgresos = satConnected ? satCalc("Egresos SAT") : calc("Gastos");
    const satBalance = satIngresos.value - satEgresos.value;
    const satIva = satConnected ? (satLatest("IVA Cobrado")?.value ?? 0) : 0;

    // ── CRM / Ventas ──────────────────────────────────────
    const ventas = calc("Ventas");
    const pipeline = calc("Pipeline Total");
    const leads = calc("Nuevos Leads");
    const deals = latest("Deals Cerrados")?.value ?? 0;
    const leadsVal = leads.value;
    const conversion = leadsVal > 0 ? parseFloat(((deals / leadsVal) * 100).toFixed(1)) : 0;

    const prevLeads = previous("Nuevos Leads")?.value ?? 0;
    const prevDeals = previous("Deals Cerrados")?.value ?? 0;
    const prevConversion = prevLeads > 0 ? (prevDeals / prevLeads) * 100 : 0;
    const conversionChange = prevConversion > 0 ? parseFloat(((conversion - prevConversion) / prevConversion * 100).toFixed(1)) : 0;

    // ── RRHH ──────────────────────────────────────────────
    const headcount = calc("Headcount");
    const nomina = calc("Costo Nómina");

    // ── Calculated KPIs ───────────────────────────────────
    const ytdRevenue = allValues("Ingresos SAT").concat(allValues("Ingresos"))
      .filter((m) => m.period.getFullYear() === currentYear)
      .reduce((sum, m) => sum + m.value, 0);

    const ytdGastos = allValues("Egresos SAT").concat(allValues("Gastos"))
      .filter((m) => m.period.getFullYear() === currentYear)
      .reduce((sum, m) => sum + m.value, 0);

    const annualProjection = currentMonth > 0 ? (ytdRevenue / (currentMonth + 1)) * 12 : ytdRevenue * 12;
    const revenuePerEmployee = headcount.value > 0 ? satIngresos.value / headcount.value : 0;
    const utilidad = satIngresos.value - satEgresos.value;
    const margen = satIngresos.value > 0 ? (utilidad / satIngresos.value) * 100 : 0;

    // ── Monthly history ───────────────────────────────────
    const monthlyHistory: { month: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(currentYear, currentMonth - i, 1);
      const monthName = m.toLocaleDateString("es-MX", { month: "short" });

      const ingSat = satMetrics.find((v) => v.name === "Ingresos SAT" && v.period.getMonth() === m.getMonth() && v.period.getFullYear() === m.getFullYear())?.value ?? 0;
      const ingManual = allValues("Ingresos").find((v) => v.period.getMonth() === m.getMonth() && v.period.getFullYear() === m.getFullYear())?.value ?? 0;
      const ing = ingSat || ingManual;

      const gstSat = satMetrics.find((v) => v.name === "Egresos SAT" && v.period.getMonth() === m.getMonth() && v.period.getFullYear() === m.getFullYear())?.value ?? 0;
      const gstManual = allValues("Gastos").find((v) => v.period.getMonth() === m.getMonth() && v.period.getFullYear() === m.getFullYear())?.value ?? 0;
      const gst = gstSat || gstManual;

      monthlyHistory.push({ month: monthName, ingresos: ing, gastos: gst });
    }

    // ── Goals ─────────────────────────────────────────────
    const goalMetrics = await db.metric.findMany({
      where: { organizationId: orgId, name: { startsWith: "META_" } },
      orderBy: { period: "desc" },
    });
    const uniqueGoals = new Map<string, typeof goalMetrics[0]>();
    for (const g of goalMetrics) {
      if (!uniqueGoals.has(g.name)) uniqueGoals.set(g.name, g);
    }
    const goalList = Array.from(uniqueGoals.values()).map((g) => {
      const metricName = g.name.replace("META_", "");
      const currentMetric = latest(metricName);
      return {
        name: metricName,
        current: currentMetric?.value ?? 0,
        target: g.value,
        unit: currentMetric?.unit || g.unit || "",
      };
    });

    // ── Meta Ads ──────────────────────────────────────────
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
      // SAT / Fiscal
      satIngresos: satIngresos.value,
      satIngresosChange: satIngresos.change,
      satEgresos: satEgresos.value,
      satEgresosChange: satEgresos.change,
      satBalance,
      satIva,
      satConnected,
      // CRM
      ventas: ventas.value,
      ventasChange: ventas.change,
      pipeline: pipeline.value,
      pipelineChange: pipeline.change,
      leads: leads.value,
      leadsChange: leads.change,
      conversion,
      conversionChange,
      // HR
      employees: headcount.value,
      employeesChange: headcount.change,
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
      goals: goalList,
      monthlyHistory,
      metaSummary,
      metaConnected: !!metaIntegration,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error loading dashboard" }, { status: 500 });
  }
}
