import type { JobRole } from "@prisma/client";
import { db } from "@/server/db";
import { currentMonthMX } from "@/lib/day";

/** The four puestos that submit a daily report. DIRECCION does not. */
export const SUBMITTER_ROLES: JobRole[] = [
  "COMERCIAL",
  "MARKETING",
  "OPERACIONES",
  "ADMINISTRACION",
];

export function isSubmitterRole(role: JobRole | null | undefined): boolean {
  return !!role && SUBMITTER_ROLES.includes(role);
}

// ─── Payload validation per role ────────────────────────────────────

type ValidationResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string {
  return v == null ? "" : String(v).slice(0, 5000);
}

/**
 * Validates and strips a role-specific payload. Any field not in the role's
 * shape is ignored. For OPERACIONES the server-computed read-only fields
 * (velocidadDelMes, saludGeneral) are NOT taken from the client here — they are
 * merged in separately at save time.
 */
export function validatePayload(
  role: JobRole,
  raw: Record<string, unknown>,
): ValidationResult {
  const body = raw ?? {};
  switch (role) {
    case "COMERCIAL": {
      const leadsContactados = toInt(body.leadsContactados);
      const sesionesAgendadas = toInt(body.sesionesAgendadas);
      const respuestasRecibidas = toInt(body.respuestasRecibidas);
      if (leadsContactados === null || leadsContactados < 0)
        return { ok: false, error: "leadsContactados debe ser un entero >= 0" };
      if (sesionesAgendadas === null || sesionesAgendadas < 0)
        return { ok: false, error: "sesionesAgendadas debe ser un entero >= 0" };
      if (respuestasRecibidas === null || respuestasRecibidas < 0)
        return { ok: false, error: "respuestasRecibidas debe ser un entero >= 0" };
      return {
        ok: true,
        payload: {
          leadsContactados,
          sesionesAgendadas,
          respuestasRecibidas,
          notas: toStr(body.notas),
        },
      };
    }
    case "MARKETING": {
      const leadsGenerados = toInt(body.leadsGenerados);
      const videosSubidos = toInt(body.videosSubidos);
      const avanceOperativo = toNum(body.avanceOperativo);
      if (leadsGenerados === null || leadsGenerados < 0)
        return { ok: false, error: "leadsGenerados debe ser un entero >= 0" };
      if (videosSubidos === null || videosSubidos < 0)
        return { ok: false, error: "videosSubidos debe ser un entero >= 0" };
      if (avanceOperativo === null || avanceOperativo < 0 || avanceOperativo > 100)
        return { ok: false, error: "avanceOperativo debe estar entre 0 y 100" };
      return {
        ok: true,
        payload: { leadsGenerados, videosSubidos, avanceOperativo },
      };
    }
    case "OPERACIONES": {
      // Only the editable fields are validated here; computed fields are merged
      // server-side at save time and overwrite anything sent by the client.
      const crecimientoCartera = toNum(body.crecimientoCartera);
      const clientesActivos = toInt(body.clientesActivos);
      const proyectosActivos = toInt(body.proyectosActivos);
      if (crecimientoCartera === null)
        return { ok: false, error: "crecimientoCartera debe ser un número" };
      if (clientesActivos === null || clientesActivos < 0)
        return { ok: false, error: "clientesActivos debe ser un entero >= 0" };
      if (proyectosActivos === null || proyectosActivos < 0)
        return { ok: false, error: "proyectosActivos debe ser un entero >= 0" };
      return {
        ok: true,
        payload: {
          crecimientoCartera,
          clientesActivos,
          proyectosActivos,
          notas: toStr(body.notas),
        },
      };
    }
    case "ADMINISTRACION": {
      const porCobrar = toNum(body.porCobrar);
      const cobrado = toNum(body.cobrado);
      const facturasPagadas = toInt(body.facturasPagadas);
      const facturasTotal = toInt(body.facturasTotal);
      const vencido30 = toNum(body.vencido30);
      if (porCobrar === null || porCobrar < 0)
        return { ok: false, error: "porCobrar debe ser un número >= 0" };
      if (cobrado === null || cobrado < 0)
        return { ok: false, error: "cobrado debe ser un número >= 0" };
      if (facturasPagadas === null || facturasPagadas < 0)
        return { ok: false, error: "facturasPagadas debe ser un entero >= 0" };
      if (facturasTotal === null || facturasTotal < 0)
        return { ok: false, error: "facturasTotal debe ser un entero >= 0" };
      if (vencido30 === null || vencido30 < 0)
        return { ok: false, error: "vencido30 debe ser un número >= 0" };
      return {
        ok: true,
        payload: {
          porCobrar,
          cobrado,
          facturasPagadas,
          facturasTotal,
          vencido30,
          notas: toStr(body.notas),
        },
      };
    }
    default:
      return { ok: false, error: "Tu puesto no envía reporte diario" };
  }
}

// ─── Server-computed OPERACIONES fields ─────────────────────────────

export type OperacionesComputed = {
  velocidadDelMes: number; // tareas completadas/total del mes actual * 100
  saludGeneral: "VERDE" | "AMARILLO" | "ROJO";
  counts: { verde: number; amarillo: number; rojo: number };
};

/**
 * Computes the read-only OPERACIONES fields for an org:
 *  - velocidadDelMes: (tareas completadas / total del mes actual) * 100, 0 si none.
 *    Reuses the same completadas/total logic as /api/tareas.
 *  - saludGeneral: worst-case among non-BAJA clientes (ROJO > AMARILLO > VERDE),
 *    plus counts of each salud bucket.
 */
export async function computeOperaciones(orgId: string): Promise<OperacionesComputed> {
  const mes = currentMonthMX();

  const tareas = await db.tarea.findMany({
    where: { organizationId: orgId, mes },
    select: { estatus: true },
  });
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estatus === "COMPLETADA").length;
  const velocidadDelMes = total > 0 ? (completadas / total) * 100 : 0;

  const clientes = await db.cliente.findMany({
    where: { organizationId: orgId, estatus: { not: "BAJA" } },
    select: { salud: true },
  });
  const counts = { verde: 0, amarillo: 0, rojo: 0 };
  for (const c of clientes) {
    if (c.salud === "ROJO") counts.rojo++;
    else if (c.salud === "AMARILLO") counts.amarillo++;
    else counts.verde++;
  }
  const saludGeneral: OperacionesComputed["saludGeneral"] =
    counts.rojo > 0 ? "ROJO" : counts.amarillo > 0 ? "AMARILLO" : "VERDE";

  return { velocidadDelMes, saludGeneral, counts };
}
