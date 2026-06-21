import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { activeOrgId: true } });
  return user?.activeOrgId ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.bankReference !== undefined) data.bankReference = body.bankReference;
  if (body.movementType !== undefined) data.movementType = body.movementType;
  if (body.deposit !== undefined) data.deposit = body.deposit === "" ? null : Number(body.deposit);
  if (body.withdrawal !== undefined) data.withdrawal = body.withdrawal === "" ? null : Number(body.withdrawal);
  if (body.concept !== undefined) data.concept = body.concept;
  if (body.provider !== undefined) data.provider = body.provider;
  if (body.reference !== undefined) data.reference = body.reference;
  if (body.invoiceUuid !== undefined) data.invoiceUuid = body.invoiceUuid;
  if (body.taxRate !== undefined) data.taxRate = body.taxRate === "" ? null : Number(body.taxRate);
  if (body.salesType !== undefined) data.salesType = body.salesType;
  if (body.incomeCategories !== undefined) data.incomeCategories = body.incomeCategories;
  if (body.expenseCategories !== undefined) data.expenseCategories = body.expenseCategories;
  if (body.notes !== undefined) data.notes = body.notes;
  const tx = await db.cashFlowTransaction.update({ where: { id: params.id }, data });
  return NextResponse.json({ transaction: tx });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.cashFlowTransaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
