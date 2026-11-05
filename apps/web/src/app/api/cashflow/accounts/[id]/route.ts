import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { parseAmount } from "../../_lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole } = access;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  let openingBalance: number | undefined;
  if (body.openingBalance !== undefined) {
    const r = parseAmount(body.openingBalance);
    if (!r.ok || r.value === null) {
      return NextResponse.json({ error: "Saldo inicial inválido" }, { status: 400 });
    }
    openingBalance = r.value;
    // The opening balance carries into every month's saldo inicial, so changing
    // it rewrites closed months too — only Dirección may do that once closed.
    const settings = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
    if (settings?.closedThroughMes && jobRole !== "DIRECCION") {
      return NextResponse.json(
        { error: "Hay meses cerrados; solo Dirección puede cambiar el saldo inicial" },
        { status: 403 },
      );
    }
  }

  let order: number | undefined;
  if (body.order !== undefined) {
    order = Number(body.order);
    if (!Number.isInteger(order)) return NextResponse.json({ error: "Orden inválido" }, { status: 400 });
  }

  await db.cashFlowAccount.updateMany({
    where: { id: params.id, organizationId: orgId },
    data: { name: body.name, bankName: body.bankName, openingBalance, order },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;
  await db.cashFlowAccount.updateMany({ where: { id: params.id, organizationId: orgId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
