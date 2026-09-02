import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// DELETE /api/ventas/[id] — DIRECCION may delete any; COMERCIAL only their own.
// Deleting a venta does NOT touch its lead. Gated by "ventas".
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "ventas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const venta = await db.venta.findFirst({
    where: { id: params.id, organizationId: orgId },
  });
  if (!venta) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const isDireccion = jobRole === "DIRECCION";
  const isOwnComercial = jobRole === "COMERCIAL" && venta.vendedorId === userId;
  if (!isDireccion && !isOwnComercial) {
    return NextResponse.json({ error: "No puedes eliminar esta venta" }, { status: 403 });
  }

  await db.venta.delete({ where: { id: params.id } });

  logActivity({ userId, organizationId: orgId, action: "venta.delete", detail: `Venta ${venta.monto}` });

  return NextResponse.json({ ok: true });
}
