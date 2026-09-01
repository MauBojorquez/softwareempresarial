import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;
  const body = await req.json();
  await db.cashFlowAccount.updateMany({
    where: { id: params.id, organizationId: orgId },
    data: { name: body.name, bankName: body.bankName, openingBalance: body.openingBalance, order: body.order },
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
