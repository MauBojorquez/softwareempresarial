import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

// GET /api/tareas?mes=YYYY-MM — list tareas (optionally by month) plus the
// month's "velocidad" (completadas/total). Gated by "tareas".
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "tareas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mes = req.nextUrl.searchParams.get("mes");
  const where: { organizationId: string; mes?: string } = { organizationId: orgId };
  if (mes && MES_RE.test(mes)) where.mes = mes;

  const rows = await db.tarea.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      cliente: { select: { id: true, nombre: true } },
      responsable: { select: { id: true, name: true, email: true } },
    },
  });

  const tareas = rows.map((t) => ({
    id: t.id,
    descripcion: t.descripcion,
    mes: t.mes,
    estatus: t.estatus,
    fechaCompletada: t.fechaCompletada,
    clienteId: t.clienteId,
    clienteNombre: t.cliente?.nombre ?? null,
    responsableId: t.responsableId,
    responsableNombre: t.responsable?.name ?? t.responsable?.email ?? null,
    createdAt: t.createdAt,
  }));

  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estatus === "COMPLETADA").length;
  const velocidad = {
    total,
    completadas,
    ratio: total > 0 ? completadas / total : 0,
  };

  // Members available as responsables (used by the UI dropdown).
  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    tareas,
    velocidad,
    members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
  });
}

// POST /api/tareas — create a tarea. Gated by "tareas".
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "tareas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));

  const descripcion = (body.descripcion ?? "").toString().trim();
  if (!descripcion) return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });

  const clienteId = (body.clienteId ?? "").toString().trim();
  if (!clienteId) return NextResponse.json({ error: "El cliente es obligatorio" }, { status: 400 });

  const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId: orgId } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });

  let mes = (body.mes ?? "").toString().trim();
  if (!mes) mes = new Date().toISOString().slice(0, 7);
  if (!MES_RE.test(mes)) return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM" }, { status: 400 });

  let responsableId: string | null = null;
  if (body.responsableId) {
    const member = await db.membership.findFirst({
      where: { userId: String(body.responsableId), organizationId: orgId },
    });
    if (!member) return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
    responsableId = String(body.responsableId);
  }

  const tarea = await db.tarea.create({
    data: {
      organizationId: orgId,
      clienteId,
      descripcion,
      mes,
      responsableId,
    },
  });

  return NextResponse.json({ tarea }, { status: 201 });
}
