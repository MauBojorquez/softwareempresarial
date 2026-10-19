import type { JobRole } from "@prisma/client";

/** Human labels for each daily-report field, per puesto. Order = display order. */
const FIELDS: Record<string, { key: string; label: string; kind?: "money" | "pct" }[]> = {
  COMERCIAL: [
    { key: "leadsContactados", label: "Leads contactados" },
    { key: "sesionesAgendadas", label: "Sesiones agendadas" },
    { key: "respuestasRecibidas", label: "Respuestas recibidas" },
  ],
  MARKETING: [
    { key: "leadsGenerados", label: "Leads generados" },
    { key: "videosSubidos", label: "Videos subidos" },
    { key: "avanceOperativo", label: "Avance operativo", kind: "pct" },
  ],
  OPERACIONES: [
    { key: "crecimientoCartera", label: "Crecimiento de cartera" },
    { key: "clientesActivos", label: "Clientes activos" },
    { key: "proyectosActivos", label: "Proyectos activos" },
    { key: "velocidadDelMes", label: "Velocidad del mes", kind: "pct" },
    { key: "saludGeneral", label: "Salud general de cartera" },
  ],
  ADMINISTRACION: [
    { key: "porCobrar", label: "Por cobrar", kind: "money" },
    { key: "cobrado", label: "Cobrado", kind: "money" },
    { key: "facturasPagadas", label: "Facturas pagadas" },
    { key: "facturasTotal", label: "Facturas totales" },
    { key: "vencido30", label: "Vencido +30 días", kind: "money" },
  ],
};

export const JOB_ROLE_LABEL: Record<JobRole, string> = {
  DIRECCION: "Dirección",
  OPERACIONES: "Operaciones",
  COMERCIAL: "Comercial",
  MARKETING: "Marketing",
  ADMINISTRACION: "Administración",
};

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function fmt(v: unknown, kind?: "money" | "pct"): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (kind === "money") return money.format(v);
    if (kind === "pct") return `${Math.round(v)}%`;
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(v);
  }
  return String(v);
}

/** Labeled rows + free-text notes of a daily report payload. */
export function formatReportPayload(
  jobRole: JobRole | null,
  payload: unknown,
): { rows: { label: string; value: string }[]; notas: string } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const rows = (FIELDS[jobRole ?? ""] ?? []).map((f) => ({ label: f.label, value: fmt(p[f.key], f.kind) }));
  return { rows, notas: typeof p.notas === "string" ? p.notas.trim() : "" };
}

/** Plain-text version (used as AI input). */
export function reportToText(jobRole: JobRole | null, payload: unknown): string {
  const { rows, notas } = formatReportPayload(jobRole, payload);
  const lines = rows.map((r) => `- ${r.label}: ${r.value}`);
  if (notas) lines.push(`- Notas: ${notas}`);
  return lines.join("\n") || "- (sin datos)";
}
