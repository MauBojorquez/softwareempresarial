import type { JobRole } from "@prisma/client";
import { can, type Resource } from "@/lib/access";

/**
 * The personalizable "Resumen" is composed of blocks. Each block maps to a
 * coarse RBAC resource; a member may pick a block only if `can(jobRole, resource)`
 * so the dashboard never surfaces data the role isn't allowed to see. The block
 * data endpoint (`/api/resumen`) re-checks the same resource per block, so the
 * registry is the single source of truth for the block→resource mapping.
 */
export type Block = {
  id: string;
  label: string;
  resource: Resource;
};

export const BLOCKS: Block[] = [
  { id: "numeroCritico", label: "Número Crítico", resource: "dashboard_direccion" },
  { id: "cartera", label: "Cartera", resource: "cartera" },
  { id: "embudo", label: "Embudo del CRM", resource: "crm" },
  { id: "ventasVendedor", label: "Ventas por vendedor", resource: "dashboard_direccion" },
  { id: "reportesDia", label: "Reportes del día", resource: "reportes_all" },
  { id: "rocas", label: "Rocas", resource: "rocas" },
  { id: "tareas", label: "Tareas del mes", resource: "tareas" },
  { id: "cobranza", label: "Cobranza", resource: "cobranza" },
  { id: "flujo", label: "Flujo de efectivo", resource: "flujo" },
  { id: "marketing", label: "Marketing", resource: "marketing" },
];

const BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));

/** Look up a block by id. */
export function blockById(id: string): Block | undefined {
  return BY_ID.get(id);
}

/** The blocks a given jobRole is allowed to see, in registry order. */
export function availableBlocks(jobRole: JobRole | null | undefined): Block[] {
  return BLOCKS.filter((b) => can(jobRole, b.resource));
}

/**
 * Per-role default block selection (ordered). Always filter these through
 * `availableBlocks` before storing/returning so a default is never a forbidden
 * block (defensive — the lists below already respect the RBAC matrix).
 */
export const DEFAULTS: Record<JobRole, string[]> = {
  DIRECCION: ["numeroCritico", "cartera", "embudo", "ventasVendedor", "reportesDia", "rocas"],
  OPERACIONES: ["cartera", "tareas", "rocas"],
  COMERCIAL: ["embudo", "marketing", "rocas"],
  MARKETING: ["marketing", "embudo", "rocas"],
  ADMINISTRACION: ["cobranza", "flujo", "cartera", "rocas"],
};

/** DEFAULTS for a role, filtered to only blocks that role may actually see. */
export function defaultsFor(jobRole: JobRole | null | undefined): string[] {
  if (!jobRole) return [];
  const allowed = new Set(availableBlocks(jobRole).map((b) => b.id));
  return (DEFAULTS[jobRole] ?? []).filter((id) => allowed.has(id));
}
