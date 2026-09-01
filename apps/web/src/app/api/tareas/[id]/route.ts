import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

async function ownRow(orgId: string, id: string) {
  return db.tarea.findFirst({ where: { id, organizationId: orgId } });
}

// PATCH /api/tareas/[id] — edit a tarea. Marking COMPLETADA stamps
// fechaCompletada=now; reverting to PENDIENTE clears it. Gated by "tareas".
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "tareas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.descripcion !== undefined) {
    const descripcion = String(body.descripcion).trim();
    if (!descripcion) return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    data.descripcion = descripcion;
  }
  if (body.mes !== undefined) {
    const mes = String(body.mes).trim();
    if (!MES_RE.test(mes)) return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM" }, { status: 400 });
    data.mes = mes;
  }
  if (body.responsableId !== undefined) {
    if (!body.responsableId) {
      data.responsableId = null;
    } else {
      const member = await db.membership.findFirst({
        where: { userId: String(body.responsableId), organizationId: orgId },
      });
      if (!member) return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
      data.responsableId = String(body.responsableId);
    }
  }
  if (body.estatus !== undefined) {
    if (body.estatus === "COMPLETADA") {
      data.estatus = "COMPLETADA";
      data.fechaCompletada = existing.fechaCompletada ?? new Date();
    } else if (body.estatus === "PENDIENTE") {
      data.estatus = "PENDIENTE";
      data.fechaCompletada = null;
    } else {
      return NextResponse.json({ error: "Estatus inválido" }, { status: 400 });
    }
  }

  const tarea = await db.tarea.update({ where: { id: params.id }, data });
  return NextResponse.json({ tarea });
}

// DELETE /api/tareas/[id] — hard delete. Gated by "tareas".
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "tareas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.tarea.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
