import type { JobRole } from "@prisma/client";
import { db } from "@/server/db";
import { currentMonthMX, dayRangeMX, monthRangeMX, todayMX } from "@/lib/day";
import { computeNumeroCritico, computeTareas, getMonthPayments } from "@/lib/block-data";
import { computeOperaciones } from "@/lib/daily-report";
import { rocaColor } from "@/lib/roca-color";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${Math.round(n)}%`;
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);

/** Cobranza del mes vs. meta (Número Crítico). Null when no meta is set. */
export async function metaCobranzaTexto(orgId: string): Promise<string | null> {
  const mes = currentMonthMX();
  const { start, end } = monthRangeMX(mes);
  const { cobradoTotal } = await getMonthPayments(orgId, start, end);
  const nc = await computeNumeroCritico(orgId, mes, cobradoTotal);
  if (!nc.meta) return null;
  return `Cobranza del mes: ${money(nc.cobrado)} de ${money(nc.meta)} (${pct(nc.avancePct)}), faltan ${money(nc.faltante)} en ${nc.diasRestantes} días (≈ ${money(nc.ritmoDiario)} por día). Semáforo: ${nc.semaforo}.`;
}

/** Venta del mes de un vendedor vs. su meta. Null when there is nothing to report. */
async function metaVentaTexto(orgId: string, userId: string): Promise<string | null> {
  const mes = currentMonthMX();
  const { start, end } = monthRangeMX(mes);
  const [target, ventas] = await Promise.all([
    db.vendorTarget.findFirst({ where: { organizationId: orgId, mes, userId } }),
    db.venta.aggregate({
      where: { organizationId: orgId, vendedorId: userId, fechaCierre: { gte: start, lt: end } },
      _sum: { monto: true },
    }),
  ]);
  const vendido = ventas._sum.monto ?? 0;
  if (!target?.meta && !vendido) return null;
  if (!target?.meta) return `Venta del mes: ${money(vendido)} (sin meta asignada).`;
  return `Venta del mes: ${money(vendido)} de ${money(target.meta)} (${pct((vendido / target.meta) * 100)}).`;
}

/** The monthly goal line that matters for a given puesto. */
export async function metaPorPuesto(orgId: string, userId: string, jobRole: JobRole | null): Promise<string | null> {
  switch (jobRole) {
    case "COMERCIAL":
      return metaVentaTexto(orgId, userId);
    case "ADMINISTRACION":
    case "DIRECCION":
      return metaCobranzaTexto(orgId);
    case "OPERACIONES": {
      const op = await computeOperaciones(orgId);
      return `Velocidad de tareas del mes: ${pct(op.velocidadDelMes)}. Salud general de cartera: ${op.saludGeneral ?? "sin datos"} (${op.counts.verde} verde, ${op.counts.amarillo} amarillo, ${op.counts.rojo} rojo).`;
    }
    case "MARKETING": {
      const { start, end } = monthRangeMX(currentMonthMX());
      const n = await db.lead.count({ where: { organizationId: orgId, origen: "META", createdAt: { gte: start, lt: end } } });
      return `Leads de Meta en el mes: ${n}.`;
    }
    default:
      return null;
  }
}

/** Org-level month context for the director's digest (plain text, AI input). */
export async function contextoMesTexto(orgId: string): Promise<string> {
  const mes = currentMonthMX();
  const lines: string[] = [];
  const cobranza = await metaCobranzaTexto(orgId);
  if (cobranza) lines.push(`- ${cobranza}`);
  const t = await computeTareas(orgId, mes);
  lines.push(`- Tareas del mes: ${t.completadas} de ${t.total} completadas (${pct(t.velocidad * 100)}).`);
  const rocas = await db.roca.findMany({
    where: { organizationId: orgId, mes },
    include: { dueno: { select: { name: true, email: true } } },
  });
  for (const r of rocas) {
    const color = rocaColor(r.createdAt, r.fechaLimite, r.porcentajeAvance);
    lines.push(`- Roca "${r.titulo}" (${r.dueno.name ?? r.dueno.email}): ${r.porcentajeAvance}% · ${color}`);
  }
  return lines.join("\n");
}

/** Personal app data for the 9:50 email: overdue/today tasks, at-risk rocas, all rocas as AI context. */
export async function datosPersonales(orgId: string, userId: string) {
  const hoy = todayMX();
  const { end: finHoy } = dayRangeMX(hoy);
  const mes = currentMonthMX();

  const [tareas, rocas] = await Promise.all([
    db.tarea.findMany({
      where: { organizationId: orgId, responsableId: userId, estatus: "PENDIENTE", fechaLimite: { lt: finHoy } },
      include: { cliente: { select: { nombre: true } } },
      orderBy: { fechaLimite: "asc" },
      take: 30,
    }),
    db.roca.findMany({
      where: { organizationId: orgId, duenoId: userId, mes },
      orderBy: { fechaLimite: "asc" },
    }),
  ]);

  const tareasTxt = tareas.map((t) => {
    const f = t.fechaLimite ? ymd(t.fechaLimite) : "";
    return `${t.descripcion} — ${t.cliente.nombre}${f ? ` — ${f === hoy ? "vence hoy" : `venció el ${f}`}` : ""}`;
  });

  const rocasTodas = rocas.map((r) => ({
    texto: `${r.titulo} — ${r.porcentajeAvance}% de avance — límite ${ymd(r.fechaLimite)} — métrica: ${r.metricaExito}`,
    color: rocaColor(r.createdAt, r.fechaLimite, r.porcentajeAvance),
  }));
  const rocasRiesgo = rocasTodas.filter((r) => r.color !== "VERDE").map((r) => `${r.texto} (${r.color})`);

  return {
    tareas: tareasTxt,
    rocasRiesgo,
    rocasTexto: rocasTodas.map((r) => `- ${r.texto} (${r.color})`).join("\n") || "- (sin rocas este mes)",
  };
}
