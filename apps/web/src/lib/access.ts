import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { JobRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getMobileUser } from "@/lib/mobile-auth";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

/**
 * Backend RBAC — single source of truth for who can read/use what.
 *
 * A "resource" is a coarse capability area. Row-level filtering (e.g. Marketing
 * only seeing their own leads) is enforced separately inside each endpoint;
 * `can()` only answers the coarse "may this job role touch this area at all?".
 */
export type Resource =
  | "clientes"
  | "cartera"
  | "cobranza"
  | "flujo"
  | "crm"
  | "ventas"
  | "tareas"
  | "reportes_all"
  | "reporte_propio"
  | "rocas"
  | "dashboard_direccion"
  | "metas"
  | "marketing";

// Per-role allow-lists. Anything not listed is denied.
const MATRIX: Record<JobRole, Set<Resource>> = {
  DIRECCION: new Set<Resource>([
    "clientes", "cartera", "cobranza", "flujo", "crm", "ventas", "tareas",
    "reportes_all", "reporte_propio", "rocas", "dashboard_direccion", "metas",
    "marketing",
  ]),
  OPERACIONES: new Set<Resource>([
    "clientes", "cartera", "tareas", "reporte_propio", "rocas",
  ]),
  COMERCIAL: new Set<Resource>([
    "crm", "ventas", "reporte_propio", "rocas", "marketing",
  ]),
  MARKETING: new Set<Resource>([
    // CRM is allowed but the endpoint must restrict Marketing to their own leads.
    "crm", "reporte_propio", "rocas", "marketing",
  ]),
  ADMINISTRACION: new Set<Resource>([
    "clientes", "cartera", "cobranza", "flujo", "ventas", "tareas",
    "reporte_propio", "rocas",
  ]),
};

/**
 * Returns whether `jobRole` is allowed to read/use `resource`.
 *
 * Deny-by-default: a member without a puesto (null/undefined jobRole) gets
 * nothing. (The temporary migration fail-open for legacy ADMINs was removed
 * once all members were assigned their jobRole.)
 */
export function can(
  jobRole: JobRole | null | undefined,
  resource: Resource,
): boolean {
  if (!jobRole) return false;
  return MATRIX[jobRole].has(resource);
}

type AccessGrant = { orgId: string; jobRole: JobRole | null; userId: string };

/**
 * Resolves the caller (mobile token OR web session) and their Membership for the
 * active org WITHOUT enforcing any resource. Use this for endpoints that any
 * authenticated member may call but whose response depends on the caller's
 * jobRole (e.g. the personalizable Resumen). Returns { orgId, jobRole, userId }
 * on success, or a NextResponse (401) the caller must return as-is.
 */
export async function resolveMember(
  req: NextRequest,
): Promise<AccessGrant | NextResponse> {
  const orgId = await getOrganizationId(req);

  const mobile = await getMobileUser(req);
  let userId = mobile?.userId ?? null;
  if (!userId) {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id ?? null;
  }

  if (!userId || !orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId, organizationId: orgId },
    select: { jobRole: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return { orgId, jobRole: membership.jobRole, userId };
}

/**
 * Resolves the caller (mobile token OR web session), loads their Membership for
 * the active org, and enforces `can()` for `resource`.
 *
 * On success returns { orgId, jobRole, userId }. On failure returns a
 * NextResponse (401 when unauthenticated, 403 when the role lacks access) — the
 * caller must return it as-is. The mobile-auth path keeps working because the
 * caller is resolved via getOrganizationId / getMobileUser, not the session
 * alone.
 */
export async function requireAccess(
  req: NextRequest,
  resource: Resource,
): Promise<AccessGrant | NextResponse> {
  const orgId = await getOrganizationId(req);

  // Resolve the caller's userId from the mobile token first, then the session.
  const mobile = await getMobileUser(req);
  let userId = mobile?.userId ?? null;
  if (!userId) {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id ?? null;
  }

  if (!userId || !orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId, organizationId: orgId },
    select: { jobRole: true, role: true, organizationId: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowed = can(membership.jobRole, resource);

  if (!allowed) {
    return NextResponse.json(
      { error: "No tienes acceso a esta sección" },
      { status: 403 },
    );
  }

  return { orgId, jobRole: membership.jobRole, userId };
}
