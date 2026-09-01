import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

// DELETE /api/receivables/[id]/payments/[paymentId] — remove an abono. Gated by
// "cobranza" (only ADMINISTRACION / DIRECCION).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; paymentId: string } },
) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  // Ensure both the receivable and payment belong to the caller's org.
  const payment = await db.payment.findFirst({
    where: {
      id: params.paymentId,
      receivableId: params.id,
      receivable: { organizationId: orgId },
    },
  });
  if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.payment.delete({ where: { id: params.paymentId } });
  return NextResponse.json({ ok: true });
}
