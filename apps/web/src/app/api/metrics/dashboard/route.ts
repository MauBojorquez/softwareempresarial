import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

type M = { name: string; value: number; unit: string | null; period: Date; category: string; source: string | null };

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const metrics = (await db.metric.findMany({
      where: { organizationId: orgId },
      orderBy: { period: "desc" },
    })) as unknown as M[];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prev = new Date(currentYear, currentMonth - 1, 1);

    const inMonth = (d: Date, y: number, mo: number) => d.getMonth() === mo && d.getFullYear() === y;
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    /**
     * Sums every metric in a category whose name matches any keyword (and none
     * of the excludes) for a given month. This lets manually-entered rows with
     * slightly different names ("Venta", "Venta producto X", "Ingreso por venta")
     * all roll up into the same KPI.
     */
    const sumMonth = (
      category: string,
      keywords: string[],
      year: number,
      month: number,
      excludes: string[] = [],
      source?: string | null,
    ) =>
      metrics
        .filter((m) => {
          if (m.category !== category) return false;
          if (source !== undefined && m.source !== source) return false;
          if (!inMonth(m.period, year, month)) return false;
          const n = norm(m.name);
          if (excludes.some((e) => n.includes(e))) return false;
          return keywords.some((k) => n.includes(k));
        })
        .reduce((s, m) => s + m.value, 0);

    /** Latest single value matching keywords (for snapshots like pipeline/headcount). */
    const latestMatch = (category: string, keywords: string[], excludes: string[] = []) =>
      metrics.find((m) => {
        if (m.category !== category) return false;
        const n = norm(m.name);
        if (excludes.some((e) => n.includes(e))) return false;
        return keywords.some((k) => n.includes(k));
      })?.value ?? 0;

    const pctChange = (curr: number, before: number) =>
      before !== 0 ? parseFloat((((curr - before) / before) * 100).toFixed(1)) : 0;

    const flow = (category: string, keywords: string[], excludes: string[] = [], source?: string | null) => {
      const curr = sumMonth(category, keywords, currentYear, currentMonth, excludes, source);
      const before = sumMonth(category, keywords, prev.getFullYear(), prev.getMonth(), excludes, source);
      return { value: curr, change: pctChange(curr, before) };
    };

    // ── Finanzas Fiscales (SAT) ───────────────────────────
    const satCredential = await db.satCredential.findUnique({ where: { organizationId: orgId } });
    const satConnected = !!satCredential;

    // When SAT is connected we trust SAT-sourced metrics; otherwise we sum
    // whatever the user entered manually in FINANCE.
    const ingresoKw = ["ingreso", "venta", "facturado", "facturacion", "cobrado"];
    const egresoKw = ["egreso", "gasto", "compra", "costo", "pago"];

    const satIngresos = satConnected
      ? flow("FINANCE", ["ingreso"], [], "SAT")
      : flow("FINANCE", ingresoKw, []);
    const satEgresos = satConnected
      ? flow("FINANCE", ["egreso"], [], "SAT")
      : flow("FINANCE", egresoKw, []);
    const satBalance = satIngresos.value - satEgresos.value;
    const satIva = satConnected
      ? sumMonth("FINANCE", ["iva"], currentYear, currentMonth, [], "SAT")
      : sumMonth("FINANCE", ["iva"], currentYear, currentMonth);

    // ── CRM / Ventas ──────────────────────────────────────
    const ventas = flow("SALES", ["venta", "vendido", "facturado", "ingreso"], ["pipeline", "lead", "prospecto"]);
    const leads = flow("SALES", ["lead", "prospecto", "contacto"], ["pipeline"]);
    const dealsCurr = sumMonth("SALES", ["deal", "cerrado", "cierre", "ganado"], currentYear, currentMonth, ["pipeline"]);
    const pipeline = {
      value: latestMatch("SALES", ["pipeline", "embudo", "oportunidad"]),
      change: 0,
    };
    const conversion = leads.value > 0 ? parseFloat(((dealsCurr / leads.value) * 100).toFixed(1)) : 0;
    const prevLeads = sumMonth("SALES", ["lead", "prospecto", "contacto"], prev.getFullYear(), prev.getMonth(), ["pipeline"]);
    const prevDeals = sumMonth("SALES", ["deal", "cerrado", "cierre", "ganado"], prev.getFullYear(), prev.getMonth(), ["pipeline"]);
    const prevConversion = prevLeads > 0 ? (prevDeals / prevLeads) * 100 : 0;
    const conversionChange = pctChange(conversion, prevConversion);

    // ── RRHH ──────────────────────────────────────────────
    const headcount = latestMatch("HR", ["headcount", "empleado", "colaborador", "equipo", "personal", "plantilla"]);
    const prevHeadcount = (() => {
      const m = metrics.find((x) => x.category === "HR" && inMonth(x.period, prev.getFullYear(), prev.getMonth()) &&
        ["headcount", "empleado", "colaborador", "equipo", "personal", "plantilla"].some((k) => norm(x.name).includes(k)));
      return m?.value ?? 0;
    })();
    const nomina = latestMatch("HR", ["nomina", "sueldo", "salario", "pago de personal"]);

    // ── Calculated KPIs ───────────────────────────────────
    const sumYear = (category: string, keywords: string[], excludes: string[] = [], source?: string | null) =>
      metrics
        .filter((m) => {
          if (m.category !== category) return false;
          if (source !== undefined && m.source !== source) return false;
          if (m.period.getFullYear() !== currentYear) return false;
          const n = norm(m.name);
          if (excludes.some((e) => n.includes(e))) return false;
          return keywords.some((k) => n.includes(k));
        })
        .reduce((s, m) => s + m.value, 0);

    const ytdRevenue = satConnected ? sumYear("FINANCE", ["ingreso"], [], "SAT") : sumYear("FINANCE", ingresoKw);
    const ytdGastos = satConnected ? sumYear("FINANCE", ["egreso"], [], "SAT") : sumYear("FINANCE", egresoKw);

    const annualProjection = currentMonth >= 0 ? (ytdRevenue / (currentMonth + 1)) * 12 : ytdRevenue;
    const revenuePerEmployee = headcount > 0 ? satIngresos.value / headcount : 0;
    const utilidad = satIngresos.value - satEgresos.value;
    const margen = satIngresos.value > 0 ? (utilidad / satIngresos.value) * 100 : 0;

    // ── Monthly history (6 months) ────────────────────────
    const monthlyHistory: { month: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(currentYear, currentMonth - i, 1);
      const monthName = m.toLocaleDateString("es-MX", { month: "short" });
      const ing = satConnected
        ? sumMonth("FINANCE", ["ingreso"], m.getFullYear(), m.getMonth(), [], "SAT")
        : sumMonth("FINANCE", ingresoKw, m.getFullYear(), m.getMonth());
      const gas = satConnected
        ? sumMonth("FINANCE", ["egreso"], m.getFullYear(), m.getMonth(), [], "SAT")
        : sumMonth("FINANCE", egresoKw, m.getFullYear(), m.getMonth());
      monthlyHistory.push({ month: monthName, ingresos: ing, gastos: gas });
    }

    // ── Goals ─────────────────────────────────────────────
    const goalMetrics = await db.metric.findMany({
      where: { organizationId: orgId, name: { startsWith: "META_" } },
      orderBy: { period: "desc" },
    });
    const uniqueGoals = new Map<string, typeof goalMetrics[0]>();
    for (const g of goalMetrics) if (!uniqueGoals.has(g.name)) uniqueGoals.set(g.name, g);
    const goalList = Array.from(uniqueGoals.values()).map((g) => {
      const metricName = g.name.replace("META_", "");
      const currentMetric = metrics.find((m) => m.name === metricName);
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
      employees: headcount,
      employeesChange: pctChange(headcount, prevHeadcount),
      nomina,
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
