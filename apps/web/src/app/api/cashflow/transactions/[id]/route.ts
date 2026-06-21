import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const tx = await db.cashFlowTransaction.findFirst({
    where: { id: params.id },
    include: { account: true },
  });
  if (!tx || tx.account.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    date, bankReference, movementType, deposit, withdrawal,
    concept, provider, reference, invoiceUuid, taxRate, salesType,
    incomeCategories, expenseCategories, notes,
  } = body;

  const updated = await db.cashFlowTransaction.update({
    where: { id: params.id },
    data: {
      ...(date !== undefined && { date: new Date(date) }),
      ...(bankReference !== undefined && { bankReference }),
      ...(movementType !== undefined && { movementType }),
      ...(deposit !== undefined && { deposit: deposit !== null && deposit !== "" ? parseFloat(deposit) : null }),
      ...(withdrawal !== undefined && { withdrawal: withdrawal !== null && withdrawal !== "" ? parseFloat(withdrawal) : null }),
      ...(concept !== undefined && { concept }),
      ...(provider !== undefined && { provider }),
      ...(reference !== undefined && { reference }),
      ...(invoiceUuid !== undefined && { invoiceUuid }),
      ...(taxRate !== undefined && { taxRate: taxRate !== null && taxRate !== "" ? parseFloat(taxRate) : null }),
      ...(salesType !== undefined && { salesType }),
      ...(incomeCategories !== undefined && { incomeCategories }),
      ...(expenseCategories !== undefined && { expenseCategories }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json({ transaction: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const tx = await db.cashFlowTransaction.findFirst({
    where: { id: params.id },
    include: { account: true },
  });
  if (!tx || tx.account.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.cashFlowTransaction.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
