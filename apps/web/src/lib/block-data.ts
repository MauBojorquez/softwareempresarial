import type { JobRole, LeadEtapa } from "@prisma/client";
import { db } from "@/server/db";
import { currentMonthMX, monthRangeMX, monthProgressMX, todayMX } from "@/lib/day";
import { receivableStatus, saldo as calcSaldo } from "@/lib/cobranza";
import { SUBMITTER_ROLES } from "@/lib/daily-report";
import { saludGrupoFromCounts } from "@/lib/salud";
import { rocaColor } from "@/lib/roca-color";

/**
 * Shared per-block computations for the Dirección dashboard and the
 * personalizable Resumen. These are the single source of truth so both surfaces
 * always agree — the Dirección route and `/api/resumen` both call these.
 */

export type Semaforo = "VERDE" | "AMARILLO" | "ROJO";

export function semaforoFor(avancePct: number, mesTranscurridoPct: number): Semaforo {
  const ratio = mesTranscurridoPct > 0 ? avancePct / mesTranscurridoPct : avancePct > 0 ? 1 : 0;
  if (ratio >= 1) return "VERDE";
  if (ratio >= 0.7) return "AMARILLO";
  return "ROJO";
}

// The 7 CRM stages in pipeline order.
export const ETAPA_ORDER: LeadEtapa[] = [
  "NUEVO",
  "CONTACTADO",
  "SESION_AGENDADA",
  "DIAGNOSTICO_VENDIDO",
  "PROPUESTA_ENVIADA",
  "CERRADO_GANADO",
  "CERRADO_PERDIDO",
];

export type MonthPayments = {
  cobradoTotal: number;
  cobradoByCliente: Map<string, number>;
  cobradoByVendedor: Map<string, number>;
};

/** This month's cobrado (source of "cobrado"), with per-cliente and per-vendedor
 * breakdowns. A "paid this month" receivable is one with pagado === true whose
 * fechaPago falls within [start, end). Reused by numeroCritico, cartera and
 * ventasVendedor. Manual-name invoices have no clienteId → not attributed to a
 * cartera client. */
export async function getMonthPayments(
  orgId: string,
  start: Date,
  end: Date,
): Promise<MonthPayments> {
  const receivables = await db.receivable.findMany({
    where: {
      organizationId: orgId,
      pagado: true,
      fechaPago: { gte: start, lt: end },
    },
    select: { amount: true, clienteId: true, vendedorId: true },
  });

  let cobradoTotal = 0;
  const cobradoByCliente = new Map<string, number>();
  const cobradoByVendedor = new Map<string, number>();
  for (const r of receivables) {
    cobradoTotal += r.amount;
    if (r.clienteId) cobradoByCliente.set(r.clienteId, (cobradoByCliente.get(r.clienteId) ?? 0) + r.amount);
    if (r.vendedorId) cobradoByVendedor.set(r.vendedorId, (cobradoByVendedor.get(r.vendedorId) ?? 0) + r.amount);
  }

  return { cobradoTotal, cobradoByCliente, cobradoByVendedor };
}

// ── 1. Número Crítico ──
export async function computeNumeroCritico(orgId: string, mes: string, cobradoTotal: number) {
  const { dayOfMonth, daysInMonth, diasRestantes } = monthProgressMX();
  const monthly = await db.monthlyTarget.findUnique({
    where: { organizationId_mes: { organizationId: orgId, mes } },
  });
  const meta = monthly?.meta ?? 0;
  const cobrado = cobradoTotal;
  const avancePct = meta > 0 ? (cobrado / meta) * 100 : 0;
  const faltante = Math.max(0, meta - cobrado);
  const ritmoDiario = diasRestantes > 0 ? faltante / diasRestantes : faltante;
  const mesTranscurridoPct = daysInMonth > 0 ? (dayOfMonth / daysInMonth) * 100 : 0;
  return {
    meta,
    cobrado,
    avancePct,
    faltante,
    diasRestantes,
    ritmoDiario,
    mesTranscurridoPct,
    semaforo: semaforoFor(avancePct, mesTranscurridoPct),
  };
}

// ── 2. Cartera ──
export async function computeCartera(
  orgId: string,
  cobradoByCliente: Map<string, number>,
  cobradoTotal: number,
) {
  const clientes = await db.cliente.findMany({
    where: { organizationId: orgId },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      montoMensual: true,
      diaDePago: true,
      estatus: true,
      salud: true,
    },
  });

  const carteraClientes = clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    montoMensual: c.montoMensual,
    diaDePago: c.diaDePago,
    estatus: c.estatus,
    salud: c.salud,
    cobradoMes: cobradoByCliente.get(c.id) ?? 0,
  }));

  const carteraTotals = {
    mrrActivo: 0,
    cobradoMes: cobradoTotal,
    activo: { count: 0, monto: 0 },
    espera: { count: 0, monto: 0 },
    riesgo: { count: 0, monto: 0 }, // VENCIDO
    baja: { count: 0, monto: 0 },
  };
  const saludCounts = { verde: 0, amarillo: 0, rojo: 0 };
  for (const c of clientes) {
    if (c.estatus === "ACTIVO") {
      carteraTotals.activo.count++;
      carteraTotals.activo.monto += c.montoMensual;
      carteraTotals.mrrActivo += c.montoMensual;
    } else if (c.estatus === "ESPERA") {
      carteraTotals.espera.count++;
      carteraTotals.espera.monto += c.montoMensual;
    } else if (c.estatus === "VENCIDO") {
      carteraTotals.riesgo.count++;
      carteraTotals.riesgo.monto += c.montoMensual;
    } else if (c.estatus === "BAJA") {
      carteraTotals.baja.count++;
      carteraTotals.baja.monto += c.montoMensual;
    }
    // salud group counts among non-BAJA clientes.
    if (c.estatus !== "BAJA") {
      if (c.salud === "ROJO") saludCounts.rojo++;
      else if (c.salud === "AMARILLO") saludCounts.amarillo++;
      else saludCounts.verde++;
    }
  }
  const saludGrupo = saludGrupoFromCounts(saludCounts);

  return {
    clientes: carteraClientes,
    totals: carteraTotals,
    saludGrupo,
    saludCounts,
  };
}

// ── 3. Embudo (CRM leads) ──
export async function computeEmbudo(orgId: string) {
  const leadGroups = await db.lead.groupBy({
    by: ["etapa"],
    where: { organizationId: orgId },
    _count: { _all: true },
    _sum: { valorEstimado: true },
  });
  const countByEtapa = new Map<LeadEtapa, number>();
  const valorByEtapa = new Map<LeadEtapa, number>();
  for (const g of leadGroups) {
    countByEtapa.set(g.etapa, g._count._all);
    valorByEtapa.set(g.etapa, g._sum.valorEstimado ?? 0);
  }
  const totalLeads = leadGroups.reduce((s, g) => s + g._count._all, 0);
  return ETAPA_ORDER.map((etapa) => {
    const count = countByEtapa.get(etapa) ?? 0;
    return {
      etapa,
      count,
      pctOfTotal: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
      valor: valorByEtapa.get(etapa) ?? 0,
    };
  });
}

// ── 4. Ventas por vendedor ──
export async function computeVentasPorVendedor(
  orgId: string,
  mes: string,
  start: Date,
  end: Date,
  cobradoByVendedor: Map<string, number>,
) {
  const ventaGroups = await db.venta.groupBy({
    by: ["vendedorId"],
    where: { organizationId: orgId, fechaCierre: { gte: start, lt: end } },
    _sum: { monto: true },
  });
  const vendidoByVendedor = new Map<string, number>();
  for (const g of ventaGroups) {
    if (g.vendedorId) vendidoByVendedor.set(g.vendedorId, g._sum.monto ?? 0);
  }

  const vendorTargets = await db.vendorTarget.findMany({
    where: { organizationId: orgId, mes },
  });
  const metaByVendor = new Map(vendorTargets.map((v) => [v.userId, v.meta]));

  // Union of users with a target this month OR any venta this month.
  const vendorIds = new Set<string>();
  for (const id of metaByVendor.keys()) vendorIds.add(id);
  for (const id of vendidoByVendedor.keys()) vendorIds.add(id);

  const vendorUsers = vendorIds.size
    ? await db.user.findMany({
        where: { id: { in: Array.from(vendorIds) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameById = new Map(vendorUsers.map((u) => [u.id, u.name ?? u.email]));

  return Array.from(vendorIds)
    .map((userId) => {
      const metaV = metaByVendor.get(userId) ?? 0;
      const vendido = vendidoByVendedor.get(userId) ?? 0;
      return {
        userId,
        name: nameById.get(userId) ?? "—",
        meta: metaV,
        vendido,
        cobrado: cobradoByVendedor.get(userId) ?? 0,
        avancePct: metaV > 0 ? (vendido / metaV) * 100 : 0,
      };
    })
    .sort((a, b) => b.vendido - a.vendido);
}

// ── 5. Reportes de hoy ──
export async function computeReportesHoy(orgId: string, hoy: string) {
  const submitterMembers = await db.membership.findMany({
    where: { organizationId: orgId, jobRole: { in: SUBMITTER_ROLES } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const todayReports = await db.dailyReport.findMany({
    where: { organizationId: orgId, fecha: hoy },
    select: { userId: true, payload: true },
  });
  const payloadByUser = new Map(todayReports.map((r) => [r.userId, r.payload]));
  return submitterMembers.map((m) => {
    const submitted = payloadByUser.has(m.userId);
    return {
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      jobRole: m.jobRole as JobRole | null,
      submitted,
      payload: submitted ? payloadByUser.get(m.userId) : null,
    };
  });
}

// ── 6. Rocas del mes ──
export async function computeRocas(orgId: string, mes: string) {
  const rocasRows = await db.roca.findMany({
    where: { organizationId: orgId, mes },
    orderBy: { createdAt: "asc" },
    include: {
      dueno: { select: { name: true, email: true } },
      checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  return rocasRows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    metricaExito: r.metricaExito,
    fechaLimite: r.fechaLimite,
    estatus: rocaColor(r.createdAt, r.fechaLimite, r.porcentajeAvance),
    porcentajeAvance: r.porcentajeAvance,
    usaChecklist: r.usaChecklist,
    duenoNombre: r.dueno?.name ?? r.dueno?.email ?? null,
    checklist: r.checklist.map((i) => ({ titulo: i.titulo, done: i.done })),
  }));
}

// ── Tareas del mes ──
export async function computeTareas(orgId: string, mes: string) {
  const rows = await db.tarea.findMany({
    where: { organizationId: orgId, mes },
    select: { estatus: true },
  });
  const total = rows.length;
  const completadas = rows.filter((t) => t.estatus === "COMPLETADA").length;
  const velocidad = total > 0 ? completadas / total : 0;
  return { velocidad, total, completadas };
}

// ── Cobranza ──
export async function computeCobranza(orgId: string) {
  const receivables = await db.receivable.findMany({
    where: { organizationId: orgId },
    select: { amount: true, pagado: true, issueDate: true },
  });
  let porCobrar = 0, cobrado = 0, vencido = 0, pagadas = 0, pendientes = 0;
  for (const r of receivables) {
    const status = receivableStatus(r.pagado, r.issueDate);
    if (status === "PAGADA") {
      cobrado += r.amount;
      pagadas += 1;
    } else {
      const saldoR = calcSaldo(r.amount, r.pagado);
      porCobrar += saldoR;
      pendientes += 1;
      if (status === "VENCIDA") vencido += saldoR;
    }
  }
  return { porCobrar, cobrado, vencido, pagadas, pendientes };
}

// ── Flujo de efectivo (Caja) ──
export async function computeFlujo(orgId: string) {
  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  const inMonth = (d: Date) => d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;

  const cashAccounts = await db.cashFlowAccount.findMany({
    where: { organizationId: orgId, isActive: true },
    include: { transactions: { select: { date: true, deposit: true, withdrawal: true } } },
  });
  let saldoBancos = 0;
  let ingresosMes = 0, egresosMes = 0;
  for (const acc of cashAccounts) {
    saldoBancos += acc.openingBalance ?? 0;
    for (const tx of acc.transactions) {
      const dep = tx.deposit ?? 0;
      const wd = tx.withdrawal ?? 0;
      saldoBancos += dep - wd;
      if (inMonth(tx.date)) {
        ingresosMes += dep;
        egresosMes += wd;
      }
    }
  }
  return { saldoBancos, ingresosMes, egresosMes, flujoNeto: ingresosMes - egresosMes };
}

// ── Marketing (Meta + our leads) ──
export type MarketingFull = {
  metaConnected: boolean;
  metaLeadsMes: number;
  metaLeadsDia: number;
  porCampana: { campana: string; leads: number }[];
  conversion: { avanzaron: number; diagnostico: number; ganados: number };
  valorPesos: number;
  gasto: number;
  impresiones: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  cpl: number | null;
};
export type MarketingCountOnly = { metaLeadsMes: number; metaLeadsDia: number };

const DIAGNOSTICO_ETAPAS: LeadEtapa[] = [
  "DIAGNOSTICO_VENDIDO",
  "PROPUESTA_ENVIADA",
  "CERRADO_GANADO",
];

export async function computeMarketing(
  orgId: string,
  jobRole: JobRole | null,
): Promise<MarketingFull | MarketingCountOnly> {
  const mes = currentMonthMX();
  const { start, end } = monthRangeMX(mes);
  const hoy = todayMX();
  // MX day bounds for "today".
  const { start: dayStart, end: dayEnd } = (() => {
    // Reuse monthRangeMX-style bounds via a single-day range.
    const [y, m, d] = hoy.split("-").map(Number);
    // Local MX midnight for the day and next day, computed as UTC instants.
    const startOfMonth = monthRangeMX(`${y}-${String(m).padStart(2, "0")}`).start;
    // startOfMonth is local midnight of day 1 in UTC; add (d-1) days for day start.
    const dayMs = 24 * 60 * 60 * 1000;
    const ds = new Date(startOfMonth.getTime() + (d - 1) * dayMs);
    const de = new Date(ds.getTime() + dayMs);
    return { start: ds, end: de };
  })();

  // Month META leads.
  const metaLeads = await db.lead.findMany({
    where: { organizationId: orgId, origen: "META", createdAt: { gte: start, lt: end } },
    select: { campana: true, etapa: true, diagnosticoVentaGenerada: true, createdAt: true },
  });
  const metaLeadsMes = metaLeads.length;
  const metaLeadsDia = metaLeads.filter(
    (l) => l.createdAt >= dayStart && l.createdAt < dayEnd,
  ).length;

  // metaConnected: whether a META_ADS integration or metrics exist.
  const [metaIntegration, metaMetrics] = await Promise.all([
    db.integration.findFirst({
      where: { organizationId: orgId, type: "META_ADS", isActive: true },
    }),
    db.metric.findMany({
      where: { organizationId: orgId, source: "META_ADS", category: "MARKETING" },
      orderBy: { period: "desc" },
    }),
  ]);
  const metaConnected = !!metaIntegration || metaMetrics.length > 0;

  // COMERCIAL: count-only.
  if (jobRole === "COMERCIAL") {
    return { metaLeadsMes, metaLeadsDia };
  }

  // porCampana.
  const porCampanaMap = new Map<string, number>();
  for (const l of metaLeads) {
    const key = l.campana ?? "Sin campaña";
    porCampanaMap.set(key, (porCampanaMap.get(key) ?? 0) + 1);
  }
  const porCampana = Array.from(porCampanaMap.entries())
    .map(([campana, leads]) => ({ campana, leads }))
    .sort((a, b) => b.leads - a.leads);

  // conversion.
  let avanzaron = 0, diagnostico = 0, ganados = 0;
  for (const l of metaLeads) {
    if (l.etapa !== "NUEVO" && l.etapa !== "CERRADO_PERDIDO") avanzaron++;
    if (l.diagnosticoVentaGenerada || DIAGNOSTICO_ETAPAS.includes(l.etapa)) diagnostico++;
    if (l.etapa === "CERRADO_GANADO") ganados++;
  }

  // valorPesos: sum of Venta.monto where lead.origen=META and fechaCierre in month.
  const ventas = await db.venta.findMany({
    where: {
      organizationId: orgId,
      fechaCierre: { gte: start, lt: end },
      lead: { origen: "META" },
    },
    select: { monto: true },
  });
  const valorPesos = ventas.reduce((s, v) => s + v.monto, 0);

  // Meta metrics are stored with period = the first of the current month (the
  // meta-ads sync writes `firstOfMonth` = new Date(year, month, 1)). Prefer the
  // current-month row (matched by year+month, in both UTC and local, since the
  // sync uses local-time construction), then fall back to the latest row.
  const y = Number(mes.slice(0, 4));
  const mo = Number(mes.slice(5, 7)) - 1;
  const metaVal = (name: string): number => {
    const monthRow = metaMetrics.find(
      (m) =>
        m.name === name &&
        ((m.period.getUTCFullYear() === y && m.period.getUTCMonth() === mo) ||
          (m.period.getFullYear() === y && m.period.getMonth() === mo)),
    );
    if (monthRow) return monthRow.value;
    return metaMetrics.find((m) => m.name === name)?.value ?? 0;
  };

  const gasto = metaVal("meta_spend");
  const impresiones = metaVal("meta_impressions");
  const clicks = metaVal("meta_clicks");
  const ctr = metaVal("meta_ctr");
  const cpc = metaVal("meta_cpc");
  const cpm = metaVal("meta_cpm");
  const reach = metaVal("meta_reach");
  const cpl = gasto > 0 && metaLeadsMes > 0 ? gasto / metaLeadsMes : null;

  return {
    metaConnected,
    metaLeadsMes,
    metaLeadsDia,
    porCampana,
    conversion: { avanzaron, diagnostico, ganados },
    valorPesos,
    gasto,
    impresiones,
    clicks,
    ctr,
    cpc,
    cpm,
    reach,
    cpl,
  };
}
