import { NextRequest, NextResponse } from "next/server";
import type { JobRole, LeadEtapa, Salud } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { currentMonthMX, monthRangeMX, monthProgressMX, todayMX } from "@/lib/day";
import { SUBMITTER_ROLES } from "@/lib/daily-report";

export const dynamic = "force-dynamic";

type Semaforo = "VERDE" | "AMARILLO" | "ROJO";

function semaforoFor(avancePct: number, mesTranscurridoPct: number): Semaforo {
  const ratio = mesTranscurridoPct > 0 ? avancePct / mesTranscurridoPct : avancePct > 0 ? 1 : 0;
  if (ratio >= 1) return "VERDE";
  if (ratio >= 0.7) return "AMARILLO";
  return "ROJO";
}

// The 7 CRM stages in pipeline order.
const ETAPA_ORDER: LeadEtapa[] = [
  "NUEVO",
  "CONTACTADO",
  "SESION_AGENDADA",
  "DIAGNOSTICO_VENDIDO",
  "PROPUESTA_ENVIADA",
  "CERRADO_GANADO",
  "CERRADO_PERDIDO",
];

// GET /api/dashboard/direccion — the six blocks for the current MX month.
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "dashboard_direccion");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mes = currentMonthMX();
  const { start, end } = monthRangeMX(mes);
  const { dayOfMonth, daysInMonth, diasRestantes } = monthProgressMX();
  const hoy = todayMX();

  // ── Shared: this month's confirmed payments (source of "cobrado"). ──
  const payments = await db.payment.findMany({
    where: {
      fecha: { gte: start, lt: end },
      receivable: { organizationId: orgId },
    },
    select: {
      monto: true,
      receivable: { select: { clienteId: true, vendedorId: true } },
    },
  });

  const cobradoTotal = payments.reduce((s, p) => s + p.monto, 0);

  const cobradoByCliente = new Map<string, number>();
  const cobradoByVendedor = new Map<string, number>();
  for (const p of payments) {
    const cId = p.receivable?.clienteId;
    if (cId) cobradoByCliente.set(cId, (cobradoByCliente.get(cId) ?? 0) + p.monto);
    const vId = p.receivable?.vendedorId;
    if (vId) cobradoByVendedor.set(vId, (cobradoByVendedor.get(vId) ?? 0) + p.monto);
  }

  // ── 1. Número Crítico ──
  const monthly = await db.monthlyTarget.findUnique({
    where: { organizationId_mes: { organizationId: orgId, mes } },
  });
  const meta = monthly?.meta ?? 0;
  const cobrado = cobradoTotal;
  const avancePct = meta > 0 ? (cobrado / meta) * 100 : 0;
  const faltante = Math.max(0, meta - cobrado);
  const ritmoDiario = diasRestantes > 0 ? faltante / diasRestantes : faltante;
  const mesTranscurridoPct = daysInMonth > 0 ? (dayOfMonth / daysInMonth) * 100 : 0;
  const numeroCritico = {
    meta,
    cobrado,
    avancePct,
    faltante,
    diasRestantes,
    ritmoDiario,
    mesTranscurridoPct,
    semaforo: semaforoFor(avancePct, mesTranscurridoPct),
  };

  // ── 2. Cartera ──
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
  const saludGrupo: Salud =
    saludCounts.rojo > 0 ? "ROJO" : saludCounts.amarillo > 0 ? "AMARILLO" : "VERDE";

  const cartera = {
    clientes: carteraClientes,
    totals: carteraTotals,
    saludGrupo,
    saludCounts,
  };

  // ── 3. Embudo (CRM leads) ──
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
  const embudo = ETAPA_ORDER.map((etapa) => {
    const count = countByEtapa.get(etapa) ?? 0;
    return {
      etapa,
      count,
      pctOfTotal: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
      valor: valorByEtapa.get(etapa) ?? 0,
    };
  });

  // ── 4. Ventas por vendedor ──
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

  const ventasPorVendedor = Array.from(vendorIds)
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

  // ── 5. Reportes de hoy ──
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
  const reportesHoy = submitterMembers.map((m) => {
    const submitted = payloadByUser.has(m.userId);
    return {
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      jobRole: m.jobRole as JobRole | null,
      submitted,
      payload: submitted ? payloadByUser.get(m.userId) : null,
    };
  });

  // ── 6. Rocas del mes ──
  const rocasRows = await db.roca.findMany({
    where: { organizationId: orgId, mes },
    orderBy: { createdAt: "asc" },
    include: { dueno: { select: { name: true, email: true } } },
  });
  const rocas = rocasRows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    metricaExito: r.metricaExito,
    fechaLimite: r.fechaLimite,
    estatus: r.estatus,
    porcentajeAvance: r.porcentajeAvance,
    duenoNombre: r.dueno?.name ?? r.dueno?.email ?? null,
  }));

  return NextResponse.json({
    mes,
    hoy,
    numeroCritico,
    cartera,
    embudo,
    ventasPorVendedor,
    reportesHoy,
    rocas,
  });
}
