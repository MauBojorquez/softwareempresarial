import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { can, resolveMember } from "@/lib/access";
import { currentMonthMX, fechaMX, shiftMonth } from "@/lib/day";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";
import { receivableStatus, saldo as calcSaldo } from "@/lib/cobranza";

type M = { name: string; value: number; unit: string | null; period: Date; category: string; source: string | null };

export async function GET(req: NextRequest) {
  const member = await resolveMember(req);
  if (member instanceof NextResponse) return member;
  const orgId = member.orgId;
  // Caja (flujo) and cobranza are sensitive: only returned to roles that can
  // see those areas; everyone else gets null for those fields.
  const canFlujo = can(member.jobRole, "flujo");
  const canCobranza = can(member.jobRole, "cobranza");

  try {
    // Purge any legacy cashflow-mirrored FINANCE rows so SAT and cashflow are
    // never summed together (no double counting). Cashflow is read directly
    // from its own tables below for the dedicated "Caja" block.
    await syncCashflowMetrics(orgId).catch((e) => console.error("cashflow purge (dashboard):", e));

    // NOTE: this endpoint used to deleteMany() manual FINANCE metrics on every
    // load ("belt-and-suspenders" purge). That destroyed hand-entered data on
    // each dashboard view, so it was removed. The sums below already filter by
    // source "SAT", which is enough to avoid double counting without deleting.

    const metrics = (await db.metric.findMany({
      where: { organizationId: orgId },
      orderBy: { period: "desc" },
    })) as unknown as M[];

    // "Current month" is the business month in America/Mexico_City (never the
    // UTC month, which flips at 18:00 MX on the last day). Metric rows are then
    // bucketed by their UTC month string: manual entries are stored as
    // UTC-midnight day-1 dates ("2026-06-01" → June UTC), consistent with the
    // per-section pages and the goals API. Reading those in MX time would shift
    // a June-1 row into May. Cash transactions are real instants and are
    // bucketed by their MX month below.
    const curMes = currentMonthMX();
    const prevMes = shiftMonth(curMes, -1);
    const currentYear = Number(curMes.slice(0, 4));
    const currentMonth = Number(curMes.slice(5, 7)) - 1; // 0..11

    const metricMonth = (d: Date) => d.toISOString().slice(0, 7);
    const inMonth = (d: Date, mes: string) => metricMonth(d) === mes;
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
      mes: string,
      excludes: string[] = [],
      source?: string | null,
    ) =>
      metrics
        .filter((m) => {
          if (m.category !== category) return false;
          if (source !== undefined && m.source !== source) return false;
          if (!inMonth(m.period, mes)) return false;
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
      const curr = sumMonth(category, keywords, curMes, excludes, source);
      const before = sumMonth(category, keywords, prevMes, excludes, source);
      return { value: curr, change: pctChange(curr, before) };
    };

    // ── Finanzas Fiscales (SAT) ───────────────────────────
    // SAT integration was removed; SAT-sourced metric rows (source "SAT") are
    // no longer produced, so these sums naturally fall to 0. Kept for API shape.
    const satConnected = false;

    // When SAT is connected we trust SAT-sourced metrics; otherwise we sum
    // whatever the user entered manually in FINANCE.
    const ingresoKw = ["ingreso", "venta", "facturado", "facturacion", "cobrado"];
    const egresoKw = ["egreso", "gasto", "compra", "costo", "pago"];

    // Finanzas Fiscal = SAT only. We explicitly filter by source "SAT" so any
    // legacy manually-entered FINANCE rows (source null) never get summed in.
    // Cashflow is reported separately in the Caja block below.
    const satIngresos = flow("FINANCE", ingresoKw, [], "SAT");
    const satEgresos = flow("FINANCE", egresoKw, [], "SAT");
    const satBalance = satIngresos.value - satEgresos.value;
    const satIva = sumMonth("FINANCE", ["iva"], curMes, [], "SAT");

    // ── Flujo de Efectivo (Caja) — read straight from the source ──────────
    // Separate block, never summed with SAT. "Saldo en Bancos" = opening +
    // net movements across all active accounts (the real bank position).
    const cashAccounts = canFlujo
      ? await db.cashFlowAccount.findMany({
          where: { organizationId: orgId, isActive: true },
          include: { transactions: { select: { date: true, deposit: true, withdrawal: true } } },
        })
      : [];
    const cajaConnected = cashAccounts.length > 0;
    let cajaBalance = 0;
    let cajaDepMonth = 0, cajaWdMonth = 0, cajaDepPrev = 0, cajaWdPrev = 0;
    for (const acc of cashAccounts) {
      cajaBalance += acc.openingBalance ?? 0;
      for (const tx of acc.transactions) {
        const dep = tx.deposit ?? 0;
        const wd = tx.withdrawal ?? 0;
        cajaBalance += dep - wd;
        const txMes = fechaMX(tx.date).slice(0, 7);
        if (txMes === curMes) { cajaDepMonth += dep; cajaWdMonth += wd; }
        else if (txMes === prevMes) { cajaDepPrev += dep; cajaWdPrev += wd; }
      }
    }
    const cajaDepositsChange = pctChange(cajaDepMonth, cajaDepPrev);
    const cajaWithdrawalsChange = pctChange(cajaWdMonth, cajaWdPrev);

    // ── Cobranza (cuentas por cobrar) — read straight from the source ─────
    // Status/saldo are DERIVED from the `pagado` flag via receivableStatus().
    const receivables = canCobranza
      ? await db.receivable.findMany({
          where: { organizationId: orgId },
          select: { amount: true, pagado: true, issueDate: true },
        })
      : [];
    let cobPorCobrar = 0, cobCobrado = 0, cobVencido = 0;
    let cobPagadas = 0, cobPendientes = 0;
    for (const r of receivables) {
      const status = receivableStatus(r.pagado, r.issueDate);
      if (status === "PAGADA") {
        cobCobrado += r.amount;
        cobPagadas += 1;
      } else {
        const saldoR = calcSaldo(r.amount, r.pagado);
        cobPorCobrar += saldoR; cobPendientes += 1;
        if (status === "VENCIDA") cobVencido += saldoR;
      }
    }
    const cobranza = canCobranza ? {
      total: receivables.length,
      porCobrar: cobPorCobrar,
      cobrado: cobCobrado,
      vencido: cobVencido,
      pagadas: cobPagadas,
      pendientes: cobPendientes,
    } : null;

    // ── CRM / Ventas ──────────────────────────────────────
    const ventas = flow("SALES", ["venta", "vendido", "facturado", "ingreso"], ["pipeline", "lead", "prospecto"]);
    const leads = flow("SALES", ["lead", "prospecto", "contacto"], ["pipeline"]);
    const dealsCurr = sumMonth("SALES", ["deal", "cerrado", "cierre", "ganado"], curMes, ["pipeline"]);
    const pipeline = {
      value: latestMatch("SALES", ["pipeline", "embudo", "oportunidad"]),
      change: 0,
    };
    const conversion = leads.value > 0 ? parseFloat(((dealsCurr / leads.value) * 100).toFixed(1)) : 0;
    const prevLeads = sumMonth("SALES", ["lead", "prospecto", "contacto"], prevMes, ["pipeline"]);
    const prevDeals = sumMonth("SALES", ["deal", "cerrado", "cierre", "ganado"], prevMes, ["pipeline"]);
    const prevConversion = prevLeads > 0 ? parseFloat(((prevDeals / prevLeads) * 100).toFixed(1)) : 0;
    const conversionChange = pctChange(conversion, prevConversion);

    // ── RRHH ──────────────────────────────────────────────
    const headcount = latestMatch("HR", ["headcount", "empleado", "colaborador", "equipo", "personal", "plantilla"]);
    const prevHeadcount = (() => {
      const m = metrics.find((x) => x.category === "HR" && inMonth(x.period, prevMes) &&
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

    const ytdRevenue = sumYear("FINANCE", ingresoKw, [], "SAT");
    const ytdGastos = sumYear("FINANCE", egresoKw, [], "SAT");

    const annualProjection = currentMonth >= 0 ? (ytdRevenue / (currentMonth + 1)) * 12 : ytdRevenue;
    const revenuePerEmployee = headcount > 0 ? satIngresos.value / headcount : 0;
    const utilidad = satIngresos.value - satEgresos.value;
    const margen = satIngresos.value > 0 ? (utilidad / satIngresos.value) * 100 : 0;

    // ── Monthly history (6 months) ────────────────────────
    const monthlyHistory: { month: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mes = shiftMonth(curMes, -i);
      const m = new Date(`${mes}-01T00:00:00.000Z`);
      const monthName = m.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" });
      const ing = sumMonth("FINANCE", ingresoKw, mes, [], "SAT");
      const gas = sumMonth("FINANCE", egresoKw, mes, [], "SAT");
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
    const goalMonthKey = metricMonth;
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
      // Only this month's row (the sync stores period = first of the month,
      // built in server-local time, so match UTC or local year+month). No row
      // yet (e.g. on the 1st) → 0, never last month's numbers.
      const metaVal = (name: string) =>
        metaMetrics.find(
          (m) =>
            m.name === name &&
            ((m.period.getUTCFullYear() === currentYear && m.period.getUTCMonth() === currentMonth) ||
              (m.period.getFullYear() === currentYear && m.period.getMonth() === currentMonth)),
        )?.value ?? 0;
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
      // (null when the caller's role cannot see Flujo de Efectivo)
      cajaConnected: canFlujo ? cajaConnected : null,
      cajaBalance: canFlujo ? cajaBalance : null,
      cajaDeposits: canFlujo ? cajaDepMonth : null,
      cajaDepositsChange: canFlujo ? cajaDepositsChange : null,
      cajaWithdrawals: canFlujo ? cajaWdMonth : null,
      cajaWithdrawalsChange: canFlujo ? cajaWithdrawalsChange : null,
      // Cobranza (cuentas por cobrar) — null when the role cannot see Cobranza
      cobranza,
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
