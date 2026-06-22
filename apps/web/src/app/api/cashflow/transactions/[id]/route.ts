import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.bankReference !== undefined) data.bankReference = body.bankReference;
  if (body.movementType !== undefined) data.movementType = body.movementType;
  if (body.deposit !== undefined) data.deposit = body.deposit === "" || body.deposit === null ? null : Number(body.deposit);
  if (body.withdrawal !== undefined) data.withdrawal = body.withdrawal === "" || body.withdrawal === null ? null : Number(body.withdrawal);
  if (body.concept !== undefined) data.concept = body.concept;
  if (body.provider !== undefined) data.provider = body.provider;
  if (body.reference !== undefined) data.reference = body.reference;
  if (body.invoiceUuid !== undefined) data.invoiceUuid = body.invoiceUuid;
  if (body.taxRate !== undefined) data.taxRate = body.taxRate === "" || body.taxRate === null ? null : Number(body.taxRate);
  if (body.salesType !== undefined) data.salesType = body.salesType;
  if (body.incomeCategories !== undefined) data.incomeCategories = body.incomeCategories;
  if (body.expenseCategories !== undefined) data.expenseCategories = body.expenseCategories;
  if (body.notes !== undefined) data.notes = body.notes;

  // Ensure the transaction belongs to an account in this org before updating
  const tx = await db.cashFlowTransaction.findUnique({
    where: { id: params.id },
    include: { account: { select: { organizationId: true } } },
  });
  if (!tx || tx.account.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.cashFlowTransaction.update({ where: { id: params.id }, data });
  return NextResponse.json({ transaction: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tx = await db.cashFlowTransaction.findUnique({
    where: { id: params.id },
    include: { account: { select: { organizationId: true } } },
  });
  if (!tx || tx.account.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.cashFlowTransaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
