import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { notify } from "@/server/services/push/notify";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/receivables/[id]/payments — register an abono. Only ADMINISTRACION
// and DIRECCION (the "cobranza" resource) can confirm payments.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId, userId } = access;

  const receivable = await db.receivable.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { cliente: { select: { nombre: true } } },
  });
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

  // Best-effort push: alert Dirección + Administración that a payment came in.
  // Never blocks the response.
  try {
    const recipients = await db.membership.findMany({
      where: { organizationId: orgId, jobRole: { in: ["DIRECCION", "ADMINISTRACION"] } },
      select: { userId: true },
    });
    const cliente = receivable.cliente?.nombre;
    const message = `${cliente ? `${cliente} · ` : ""}${formatCurrency(monto)}`;
    const seen = new Set<string>();
    await Promise.all(
      recipients
        .filter((r) => !seen.has(r.userId) && seen.add(r.userId))
        .map((r) =>
          notify({
            userId: r.userId,
            title: "Cobro registrado",
            message,
            type: "cobro",
            url: "/dashboard/finance/cobranza",
          }),
        ),
    );
  } catch (e) {
    console.error("payment push notify failed:", e);
  }

  return NextResponse.json({ payment }, { status: 201 });
}
