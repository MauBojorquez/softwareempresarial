import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { notify } from "@/server/services/push/notify";
import { recomputeRocaProgress } from "@/lib/roca-checklist";
import { rocaColor } from "@/lib/roca-color";

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

  const roca = await db.roca.findFirstOrThrow({
    where: { id: params.id },
    include: {
      dueno: { select: { name: true, email: true } },
      checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });

  // Derive the color from the (possibly updated) timeline + progress. This is
  // the source of truth; persist it for storage consistency.
  const oldColor = rocaColor(existing.createdAt, existing.fechaLimite, existing.porcentajeAvance);
  const newColor = rocaColor(roca.createdAt, roca.fechaLimite, roca.porcentajeAvance);
  if (newColor !== roca.estatus) {
    await db.roca.update({ where: { id: params.id }, data: { estatus: newColor } });
  }

  // Best-effort push: when a roca transitions INTO rojo, alert its dueño and
  // every Dirección member. Never blocks the response.
  if (newColor === "ROJO" && oldColor !== "ROJO") {
    try {
      const direccion = await db.membership.findMany({
        where: { organizationId: orgId, jobRole: "DIRECCION" },
        select: { userId: true },
      });
      const recipients = new Set<string>(direccion.map((m) => m.userId));
      if (roca.duenoId) recipients.add(roca.duenoId);
      await Promise.all(
        [...recipients].map((uid) =>
          notify({
            userId: uid,
            title: "Roca en rojo",
            message: roca.titulo,
            type: "roca",
            url: "/dashboard/rocas",
          }),
        ),
      );
    } catch (e) {
      console.error("roca rojo push notify failed:", e);
    }
  }

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
