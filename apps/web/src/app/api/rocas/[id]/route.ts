import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { recomputeRocaProgress } from "@/lib/roca-checklist";
import { syncRocaColor } from "@/lib/roca-status";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

async function ownRow(orgId: string, id: string) {
  return db.roca.findFirst({ where: { id, organizationId: orgId } });
}

// PATCH /api/rocas/[id] — DIRECCION edits all fields; the dueño edits ONLY
// porcentajeAvance (for manual rocas); everyone else 403. estatus (color) is
// derived on read and never accepted from the client. Gated by "rocas".
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
  // For a checklist roca, porcentajeAvance is derived from items — ignore any
  // manual value sent in the body (the dueño changes it by toggling items).
  if (body.porcentajeAvance !== undefined && !existing.usaChecklist) {
    const p = Number(body.porcentajeAvance);
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      return NextResponse.json({ error: "El porcentaje de avance debe ser un entero entre 0 y 100" }, { status: 400 });
    }
    data.porcentajeAvance = p;
  }
  // estatus (color) is derived from fechaLimite + porcentajeAvance on read;
  // any client-sent estatus is ignored.

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
    if (body.usaChecklist !== undefined) {
      data.usaChecklist = body.usaChecklist === true;
    }
  }

  // When enabling checklist mode, the % is derived — never keep a manual value.
  const enablingChecklist = isDireccion && data.usaChecklist === true;
  if (enablingChecklist) delete data.porcentajeAvance;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  await db.roca.update({
    where: { id: params.id },
    data,
  });

  // When checklist mode is (now) on, recompute the derived % from items.
  if (enablingChecklist || (existing.usaChecklist && data.usaChecklist !== false)) {
    await recomputeRocaProgress(params.id);
  }

  // Derive the color from the (possibly updated) timeline + progress, persist
  // it, and alert Dirección + dueño on a transition into amarillo/rojo.
  const newColor = (await syncRocaColor(orgId, params.id)) ?? existing.estatus;

  const roca = await db.roca.findFirstOrThrow({
    where: { id: params.id },
    include: {
      dueno: { select: { name: true, email: true } },
      checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });

  return NextResponse.json({
    roca: {
      id: roca.id,
      titulo: roca.titulo,
      metricaExito: roca.metricaExito,
      fechaLimite: roca.fechaLimite,
      estatus: newColor,
      porcentajeAvance: roca.porcentajeAvance,
      usaChecklist: roca.usaChecklist,
      mes: roca.mes,
      duenoId: roca.duenoId,
      duenoNombre: roca.dueno?.name ?? roca.dueno?.email ?? null,
      checklist: roca.checklist.map((i) => ({
        id: i.id,
        titulo: i.titulo,
        done: i.done,
        order: i.order,
      })),
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
