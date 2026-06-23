import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";

type M = { name: string; value: number; unit: string | null; period: Date; category: string; source: string | null };

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Purge any legacy cashflow-mirrored FINANCE rows so SAT and cashflow are
    // never summed together (no double counting). Cashflow is read directly
    // from its own tables below for the dedicated "Caja" block.
    await syncCashflowMetrics(orgId).catch((e) => console.error("cashflow purge (dashboard):", e));

    const metrics = (await db.metric.findMany({
      where: { organizationId: orgId },
      orderBy: { period: "desc" },
    })) as unknown as M[];

    const now = new Date();
    // Bucket everything by UTC month. Manual entries are stored as UTC-midnight
    // day-1 dates ("2026-06-01" → June UTC), so reading in UTC keeps the
    // dashboard consistent with the per-section pages and the goals API, which
    // also bucket by the UTC month string. Reading in local time would shift a
    // June-1 row into May for any timezone west of UTC (e.g. Mexico, UTC-6).
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const prev = new Date(Date.UTC(currentYear, currentMonth - 1, 1));

    const inMonth = (d: Date, y: number, mo: number) => d.getUTCMonth() === mo && d.getUTCFullYear() === y;
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
      const before = sumMonth(category, keywords, prev.getUTCFullYear(), prev.getUTCMonth(), excludes, source);
      return { value: curr, change: pctChange(curr, before) };
    };

    // ── Finanzas Fiscales (SAT) ───────────────────────────
    const satCredential = await db.satCredential.findUnique({ where: { organizationId: orgId } });
    const satConnected = !!satCredential;

    // When SAT is connected we trust SAT-sourced metrics; otherwise we sum
    // whatever the user entered manually in FINANCE.
    const ingresoKw = ["ingreso", "venta", "facturado", "facturacion", "cobrado"];
    const egresoKw = ["egreso", "gasto", "compra", "costo", "pago"];

    // Finanzas = SAT + Flujo de Efectivo (no manual entries). Both sources
    // write FINANCE metrics named "Ingresos"/"Gastos", so we sum across all
    // sources without filtering by SAT — that naturally combines the two.
    // FINANCE rows are now SAT-only (cashflow mirror is purged), so these sum
    // exclusively the fiscal numbers — cashflow is reported separately below.
    const satIngresos = flow("FINANCE", ingresoKw, []);
    const satEgresos = flow("FINANCE", egresoKw, []);
    const satBalance = satIngresos.value - satEgresos.value;
    const satIva = sumMonth("FINANCE", ["iva"], currentYear, currentMonth);

    // ── Flujo de Efectivo (Caja) — read straight from the source ──────────
    // Separate block, never summed with SAT. "Saldo en Bancos" = opening +
    // net movements across all active accounts (the real bank position).
    const cashAccounts = await db.cashFlowAccount.findMany({
      where: { organizationId: orgId, isActive: true },
      include: { transactions: { select: { date: true, deposit: true, withdrawal: true } } },
    });
    const cajaConnected = cashAccounts.length > 0;
    let cajaBalance = 0;
    let cajaDepMonth = 0, cajaWdMonth = 0, cajaDepPrev = 0, cajaWdPrev = 0;
    for (const acc of cashAccounts) {
      cajaBalance += acc.openingBalance ?? 0;
      for (const tx of acc.transactions) {
        const dep = tx.deposit ?? 0;
        const wd = tx.withdrawal ?? 0;
        cajaBalance += dep - wd;
        if (inMonth(tx.date, currentYear, currentMonth)) { cajaDepMonth += dep; cajaWdMonth += wd; }
        else if (inMonth(tx.date, prev.getUTCFullYear(), prev.getUTCMonth())) { cajaDepPrev += dep; cajaWdPrev += wd; }
      }
    }
    const cajaDepositsChange = pctChange(cajaDepMonth, cajaDepPrev);
    const cajaWithdrawalsChange = pctChange(cajaWdMonth, cajaWdPrev);

    // ── CRM / Ventas ──────────────────────────────────────
    const ventas = flow("SALES", ["venta", "vendido", "facturado", "ingreso"], ["pipeline", "lead", "prospecto"]);
    const leads = flow("SALES", ["lead", "prospecto", "contacto"], ["pipeline"]);
    const dealsCurr = sumMonth("SALES", ["deal", "cerrado", "cierre", "ganado"], currentYear, currentMonth, ["pipeline"]);
    const pipeline = {
      value: latestMatch("SALES", ["pipeline", "embudo", "oportunidad"]),
      change: 0,
    };
    const conversion = leads.value > 0 ? parseFloat(((dealsCurr / leads.value) * 100).toFixed(1)) : 0;
    const prevLeads = sumMonth("SALES", ["lead", "prospecto", "contacto"], prev.getUTCFullYear(), prev.getUTCMonth(), ["pipeline"]);
    const prevDeals = sumMonth("SALES", ["deal", "cerrado", "cierre", "ganado"], prev.getUTCFullYear(), prev.getUTCMonth(), ["pipeline"]);
    const prevConversion = prevLeads > 0 ? (prevDeals / prevLeads) * 100 : 0;
    const conversionChange = pctChange(conversion, prevConversion);

    // ── RRHH ──────────────────────────────────────────────
    const headcount = latestMatch("HR", ["headcount", "empleado", "colaborador", "equipo", "personal", "plantilla"]);
    const prevHeadcount = (() => {
      const m = metrics.find((x) => x.category === "HR" && inMonth(x.period, prev.getUTCFullYear(), prev.getUTCMonth()) &&
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
          if (m.period.getUTCFullYear() !== currentYear) return false;
          const n = norm(m.name);
          if (excludes.some((e) => n.includes(e))) return false;
          return keywords.some((k) => n.includes(k));
        })
        .reduce((s, m) => s + m.value, 0);

    const ytdRevenue = sumYear("FINANCE", ingresoKw);
    const ytdGastos = sumYear("FINANCE", egresoKw);

    const annualProjection = currentMonth >= 0 ? (ytdRevenue / (currentMonth + 1)) * 12 : ytdRevenue;
    const revenuePerEmployee = headcount > 0 ? satIngresos.value / headcount : 0;
    const utilidad = satIngresos.value - satEgresos.value;
    const margen = satIngresos.value > 0 ? (utilidad / satIngresos.value) * 100 : 0;

    // ── Monthly history (6 months) ────────────────────────
    const monthlyHistory: { month: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(Date.UTC(currentYear, currentMonth - i, 1));
      const monthName = m.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" });
      const ing = sumMonth("FINANCE", ingresoKw, m.getUTCFullYear(), m.getUTCMonth());
      const gas = sumMonth("FINANCE", egresoKw, m.getUTCFullYear(), m.getUTCMonth());
      monthlyHistory.push({ month: monthName, ingresos: ing, gastos: gas });
    }

    // ── Goals ─────────────────────────────────────────────
    const goalMetrics = await db.metric.findMany({
      where: { organizationId: orgId, name: { startsWith: "META_" } },
      orderBy: { period: "desc" },
    });
    const uniqueGoals = new Map<string, typeof goalMetrics[0]>();
    for (const g of goalMetrics) if (!uniqueGoals.has(g.name)) uniqueGoals.set(g.name, g);
    // Current value for a goal = sum of its latest month (same logic as the charts)
    const goalMonthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const goalLatestSum = (name: string) => {
      const rows = metrics.filter((m) => m.name === name);
      if (!rows.length) return { value: 0, unit: null };
      const months = [...new Set(rows.map((m) => goalMonthKey(m.period)))].sort().reverse();
      const mk = months[0];
      const value = rows.filter((m) => goalMonthKey(m.period) === mk).reduce((s, m) => s + m.value, 0);
      return { value, unit: rows[0].unit };
    };

    const goalList = Array.from(uniqueGoals.values()).map((g) => {
      const metricName = g.name.replace("META_", "");
      // Conversión is a derived ratio, not a stored row — use the live value so
      // the overview matches the goals page instead of summing raw rows.
      const cur = metricName === "Conversión"
        ? { value: conversion, unit: "%" }
        : goalLatestSum(metricName);
      return {
        name: metricName,
        current: cur.value,
        target: g.value,
        unit: cur.unit || g.unit || "",
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
      // Flujo de Efectivo (Caja) — independent block, never summed with SAT
      cajaConnected,
      cajaBalance,
      cajaDeposits: cajaDepMonth,
      cajaDepositsChange,
      cajaWithdrawals: cajaWdMonth,
      cajaWithdrawalsChange,
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
      // Cashflow-only orgs (SAT not connected yet) still have a real dashboard.
      hasData: metrics.length > 0 || cajaConnected,
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
