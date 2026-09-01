import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

// POST /api/receivables/[id]/payments — register an abono. Only ADMINISTRACION
// and DIRECCION (the "cobranza" resource) can confirm payments.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId, userId } = access;

  const receivable = await db.receivable.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!receivable) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "El monto del abono debe ser un número mayor a 0" }, { status: 400 });
  }

  const payment = await db.payment.create({
    data: {
      receivableId: params.id,
      monto,
      fecha: body.fecha ? new Date(body.fecha) : new Date(),
      metodo: body.metodo ? String(body.metodo).trim() : null,
      notas: body.notas ? String(body.notas).trim() : null,
      registradoPorId: userId,
    },
  });

  return NextResponse.json({ payment }, { status: 201 });
}
