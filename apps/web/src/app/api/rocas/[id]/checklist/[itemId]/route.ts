import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { recomputeRocaProgress } from "@/lib/roca-checklist";
import { shapeRocaWithChecklist } from "@/lib/roca-shape";

export const dynamic = "force-dynamic";

async function loadItem(orgId: string, rocaId: string, itemId: string) {
  const roca = await db.roca.findFirst({ where: { id: rocaId, organizationId: orgId } });
  if (!roca) return { roca: null, item: null };
  const item = await db.rocaChecklistItem.findFirst({ where: { id: itemId, rocaId } });
  return { roca, item };
}

// PATCH /api/rocas/[id]/checklist/[itemId] — toggle done and/or edit titulo.
// Gated by "rocas"; allowed for DIRECCION or the roca's dueño.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const { roca, item } = await loadItem(orgId, params.id, params.itemId);
  if (!roca || !item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isDireccion = jobRole === "DIRECCION";
  const isDueno = roca.duenoId === userId;
  if (!isDireccion && !isDueno) {
    return NextResponse.json({ error: "No puedes editar esta roca" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.done !== undefined) data.done = body.done === true;
  if (body.titulo !== undefined) {
    const titulo = String(body.titulo).trim();
    if (!titulo) return NextResponse.json({ error: "El título del elemento es obligatorio" }, { status: 400 });
    data.titulo = titulo.slice(0, 300);
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  await db.rocaChecklistItem.update({ where: { id: item.id }, data });

  if (roca.usaChecklist) await recomputeRocaProgress(roca.id);

  return NextResponse.json({ roca: await shapeRocaWithChecklist(roca.id) });
}

// DELETE /api/rocas/[id]/checklist/[itemId] — remove a checklist item.
// Gated by "rocas"; allowed for DIRECCION or the roca's dueño.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const { roca, item } = await loadItem(orgId, params.id, params.itemId);
  if (!roca || !item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isDireccion = jobRole === "DIRECCION";
  const isDueno = roca.duenoId === userId;
  if (!isDireccion && !isDueno) {
    return NextResponse.json({ error: "No puedes editar esta roca" }, { status: 403 });
  }

  await db.rocaChecklistItem.delete({ where: { id: item.id } });

  if (roca.usaChecklist) await recomputeRocaProgress(roca.id);

  return NextResponse.json({ roca: await shapeRocaWithChecklist(roca.id) });
}
