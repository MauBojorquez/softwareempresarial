import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { recomputeRocaProgress } from "@/lib/roca-checklist";
import { syncRocaColor } from "@/lib/roca-status";
import { shapeRocaWithChecklist } from "@/lib/roca-shape";

export const dynamic = "force-dynamic";

// POST /api/rocas/[id]/checklist — add a checklist item.
// Gated by "rocas"; allowed for DIRECCION or the roca's dueño.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const roca = await db.roca.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!roca) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const isDireccion = jobRole === "DIRECCION";
  const isDueno = roca.duenoId === userId;
  if (!isDireccion && !isDueno) {
    return NextResponse.json({ error: "No puedes editar esta roca" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const titulo = String(body.titulo ?? "").trim();
  if (!titulo) return NextResponse.json({ error: "El título del elemento es obligatorio" }, { status: 400 });

  const count = await db.rocaChecklistItem.count({ where: { rocaId: roca.id } });
  await db.rocaChecklistItem.create({
    data: { rocaId: roca.id, titulo: titulo.slice(0, 300), order: count },
  });

  if (roca.usaChecklist) {
    await recomputeRocaProgress(roca.id);
    await syncRocaColor(orgId, roca.id);
  }

  return NextResponse.json({ roca: await shapeRocaWithChecklist(roca.id) }, { status: 201 });
}
