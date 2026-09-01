import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import type { JobRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_JOB_ROLES = ["DIRECCION", "OPERACIONES", "COMERCIAL", "MARKETING", "ADMINISTRACION"] as const;

/**
 * Resolves the caller's ADMIN (Dirección) membership for their active org, or a
 * NextResponse error. Assigning puestos is a Dirección-only action; we gate by
 * the ADMIN membership role (Dirección) so it works even while everyone's
 * jobRole is still null during migration.
 */
async function requireDireccion() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  if (membership.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Solo Dirección puede asignar puestos" }, { status: 403 }) };
  }
  return { orgId: membership.organizationId };
}

// GET /api/members — list org members with their current puesto (jobRole).
export async function GET() {
  const ctx = await requireDireccion();
  if ("error" in ctx) return ctx.error;

  const members = await db.membership.findMany({
    where: { organizationId: ctx.orgId },
    include: { user: { select: { name: true, email: true, avatar: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
      jobRole: m.jobRole,
    })),
  });
}

// PATCH /api/members — set/change a member's puesto. Body: { membershipId, jobRole|null }
export async function PATCH(req: NextRequest) {
  const ctx = await requireDireccion();
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const membershipId = String(body.membershipId ?? "");
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId requerido" }, { status: 400 });
  }

  let jobRole: JobRole | null = null;
  if (body.jobRole !== null && body.jobRole !== undefined && body.jobRole !== "") {
    if (!VALID_JOB_ROLES.includes(body.jobRole)) {
      return NextResponse.json({ error: "Puesto inválido" }, { status: 400 });
    }
    jobRole = body.jobRole as JobRole;
  }

  // Scope to the caller's org so a Dirección can only edit their own members.
  const target = await db.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.orgId },
  });
  if (!target) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const updated = await db.membership.update({
    where: { id: membershipId },
    data: { jobRole },
  });

  return NextResponse.json({ ok: true, membershipId: updated.id, jobRole: updated.jobRole });
}
