import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";
import type { IntegrationType } from "@prisma/client";

const VALID_TYPES: IntegrationType[] = ["QUICKBOOKS", "HUBSPOT", "META_ADS", "SAT", "CUSTOM_API", "SPREADSHEET"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const type = (body as { type?: unknown }).type;
  if (typeof type !== "string" || !VALID_TYPES.includes(type as IntegrationType)) {
    return NextResponse.json({ error: "Tipo de integración inválido" }, { status: 400 });
  }

  // Resolve the membership for the ACTIVE org (respects activeOrgId).
  const orgId = await getOrganizationId(req);
  const membership = orgId
    ? await db.membership.findFirst({ where: { userId: session.user.id, organizationId: orgId } })
    : null;

  if (!membership) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }

  if (membership.role !== "ADMIN" && membership.jobRole !== "DIRECCION") {
    return NextResponse.json({ error: "Solo administradores pueden desconectar integraciones" }, { status: 403 });
  }

  await db.integration.updateMany({
    where: {
      organizationId: membership.organizationId,
      type: type as IntegrationType,
    },
    data: { isActive: false, accessToken: "", refreshToken: null },
  });

  return NextResponse.json({ success: true });
}
