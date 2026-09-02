import { NextRequest, NextResponse } from "next/server";
import type { LeadOrigen, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseEmail, parsePhone } from "@/lib/lead-contact";

export const dynamic = "force-dynamic";

const ORIGENES = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"] as const;

export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  // Row-level: Marketing only sees their own leads.
  const where: Prisma.LeadWhereInput = { organizationId: orgId };
  if (jobRole === "MARKETING") where.duenoId = userId;

  const rows = await db.lead.findMany({
    where,
    orderBy: { fechaUltimoMovimiento: "desc" },
    include: {
      dueno: { select: { id: true, name: true, email: true } },
      _count: { select: { notas: true, ventas: true } },
    },
  });

  const leads = rows.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    empresa: l.empresa,
    contacto: l.contacto,
    telefono: l.telefono,
    email: l.email,
    origen: l.origen,
    etapa: l.etapa,
    valorEstimado: l.valorEstimado,
    valorMensualEstimado: l.valorMensualEstimado,
    motivoPerdida: l.motivoPerdida,
    diagnosticoVentaGenerada: l.diagnosticoVentaGenerada,
    fechaUltimoMovimiento: l.fechaUltimoMovimiento,
    createdAt: l.createdAt,
    duenoId: l.duenoId,
    duenoNombre: l.dueno?.name ?? l.dueno?.email ?? null,
    notasCount: l._count.notas,
    ventasCount: l._count.ventas,
  }));

  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    leads,
    members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
  });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, userId } = access;

  const body = await req.json().catch(() => ({}));

  const nombre = (body.nombre ?? "").toString().trim();
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const origen = body.origen as LeadOrigen;
  if (!ORIGENES.includes(origen)) {
    return NextResponse.json({ error: "El origen es obligatorio y debe ser válido" }, { status: 400 });
  }

  // Optional owner: default to the caller. Validate membership when provided.
  let duenoId = userId;
  if (body.duenoId) {
    const member = await db.membership.findFirst({
      where: { userId: String(body.duenoId), organizationId: orgId },
    });
    if (!member) return NextResponse.json({ error: "Dueño no válido" }, { status: 400 });
    duenoId = String(body.duenoId);
  }

  const emailResult = parseEmail(body.email);
  if (!emailResult.ok) return NextResponse.json({ error: emailResult.error }, { status: 400 });
  const telefonoResult = parsePhone(body.telefono);
  if (!telefonoResult.ok) return NextResponse.json({ error: telefonoResult.error }, { status: 400 });

  const valorEstimado = body.valorEstimado != null && body.valorEstimado !== "" ? Number(body.valorEstimado) : null;
  const valorMensualEstimado =
    body.valorMensualEstimado != null && body.valorMensualEstimado !== "" ? Number(body.valorMensualEstimado) : null;

  const created = await db.lead.create({
    data: {
      organizationId: orgId,
      nombre,
      empresa: body.empresa ? String(body.empresa).trim() : null,
      contacto: body.contacto ? String(body.contacto).trim() : null,
      telefono: telefonoResult.value,
      email: emailResult.value,
      origen,
      valorEstimado: valorEstimado != null && Number.isFinite(valorEstimado) ? valorEstimado : null,
      valorMensualEstimado:
        valorMensualEstimado != null && Number.isFinite(valorMensualEstimado) ? valorMensualEstimado : null,
      duenoId,
    },
  });

  logActivity({ userId, organizationId: orgId, action: "lead.create", detail: nombre });

  return NextResponse.json({ lead: created }, { status: 201 });
}
