import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import type { JobRole } from "@prisma/client";
import { logActivity } from "@/lib/activity";

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
  return { orgId: membership.organizationId, userId: session.user.id };
}

// GET /api/members — list org members with their current puesto (jobRole).
export async function GET() {
  const ctx = await requireDireccion();
  if ("error" in ctx) return ctx.error;

  const [members, organization] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: ctx.orgId },
      include: { user: { select: { name: true, email: true, avatar: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.organization.findUnique({ where: { id: ctx.orgId }, select: { ownerId: true } }),
  ]);

  return NextResponse.json({
    ownerId: organization?.ownerId ?? null,
    currentUserId: ctx.userId,
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

// DELETE /api/members — remove a member's access. Body or query: { membershipId }
// Dirección/ADMIN only. Cannot delete own membership or the org owner's.
export async function DELETE(req: NextRequest) {
  const ctx = await requireDireccion();
  if ("error" in ctx) return ctx.error;

  let membershipId = req.nextUrl.searchParams.get("membershipId") ?? "";
  if (!membershipId) {
    const body = await req.json().catch(() => ({}));
    membershipId = String(body.membershipId ?? "");
  }
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId requerido" }, { status: 400 });
  }

  // Scope to the caller's org so a Dirección can only remove their own members.
  const target = await db.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.orgId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  if (target.userId === ctx.userId) {
    return NextResponse.json({ error: "No puedes eliminar tu propio acceso" }, { status: 400 });
  }

  const organization = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { ownerId: true },
  });
  if (organization?.ownerId === target.userId) {
    return NextResponse.json({ error: "No puedes eliminar al dueño" }, { status: 400 });
  }

  await db.membership.delete({ where: { id: membershipId } });

  logActivity({
    userId: ctx.userId,
    organizationId: ctx.orgId,
    action: "member.remove",
    detail: target.user.email,
  });

  return NextResponse.json({ ok: true });
}
