import { NextRequest, NextResponse } from "next/server";
import type { Salud } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;
const SALUD = ["VERDE", "AMARILLO", "ROJO"] as const;

async function ownRow(orgId: string, id: string) {
  return db.roca.findFirst({ where: { id, organizationId: orgId } });
}

// PATCH /api/rocas/[id] — DIRECCION edits all fields; the dueño edits ONLY
// porcentajeAvance + estatus; everyone else 403. Gated by "rocas".
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isDireccion = jobRole === "DIRECCION";
  const isDueno = existing.duenoId === userId;
  if (!isDireccion && !isDueno) {
    return NextResponse.json({ error: "No puedes editar esta roca" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  // Fields any owner (or Dirección) may change.
  if (body.porcentajeAvance !== undefined) {
    const p = Number(body.porcentajeAvance);
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      return NextResponse.json({ error: "El porcentaje de avance debe ser un entero entre 0 y 100" }, { status: 400 });
    }
    data.porcentajeAvance = p;
  }
  if (body.estatus !== undefined) {
    if (!SALUD.includes(body.estatus)) {
      return NextResponse.json({ error: "Estatus inválido" }, { status: 400 });
    }
    data.estatus = body.estatus as Salud;
  }

  // Dirección-only fields.
  if (isDireccion) {
    if (body.titulo !== undefined) {
      const titulo = String(body.titulo).trim();
      if (!titulo) return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
      data.titulo = titulo;
    }
    if (body.metricaExito !== undefined) {
      const metricaExito = String(body.metricaExito).trim();
      if (!metricaExito) return NextResponse.json({ error: "La métrica de éxito es obligatoria" }, { status: 400 });
      data.metricaExito = metricaExito;
    }
    if (body.fechaLimite !== undefined) {
      if (!body.fechaLimite || Number.isNaN(new Date(body.fechaLimite).getTime())) {
        return NextResponse.json({ error: "Fecha límite inválida" }, { status: 400 });
      }
      data.fechaLimite = new Date(body.fechaLimite);
    }
    if (body.mes !== undefined) {
      const mes = String(body.mes).trim();
      if (!MES_RE.test(mes)) return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM" }, { status: 400 });
      data.mes = mes;
    }
    if (body.duenoId !== undefined) {
      const duenoId = String(body.duenoId).trim();
      const member = await db.membership.findFirst({ where: { userId: duenoId, organizationId: orgId } });
      if (!member) return NextResponse.json({ error: "Dueño no válido" }, { status: 400 });
      data.duenoId = duenoId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const roca = await db.roca.update({
    where: { id: params.id },
    data,
    include: { dueno: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    roca: {
      id: roca.id,
      titulo: roca.titulo,
      metricaExito: roca.metricaExito,
      fechaLimite: roca.fechaLimite,
      estatus: roca.estatus,
      porcentajeAvance: roca.porcentajeAvance,
      mes: roca.mes,
      duenoId: roca.duenoId,
      duenoNombre: roca.dueno?.name ?? roca.dueno?.email ?? null,
    },
  });
}

// DELETE /api/rocas/[id] — DIRECCION only. Gated by "rocas".
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole } = access;

  if (jobRole !== "DIRECCION") {
    return NextResponse.json({ error: "Solo Dirección puede eliminar rocas" }, { status: 403 });
  }

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.roca.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
