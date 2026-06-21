import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const account = await db.cashFlowAccount.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const transactions = await db.cashFlowTransaction.findMany({
    where: { accountId: params.id },
    orderBy: [{ date: "asc" }, { order: "asc" }],
  });

  // Compute running balance
  let balance = account.openingBalance;
  const withBalance = transactions.map((t) => {
    balance += (t.deposit ?? 0) - (t.withdrawal ?? 0);
    return { ...t, balance };
  });

  return NextResponse.json({ transactions: withBalance, account });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const account = await db.cashFlowAccount.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    date, bankReference, movementType, deposit, withdrawal,
    concept, provider, reference, invoiceUuid, taxRate, salesType,
    incomeCategories, expenseCategories, notes,
  } = body;

  const count = await db.cashFlowTransaction.count({ where: { accountId: params.id } });

  const transaction = await db.cashFlowTransaction.create({
    data: {
      accountId: params.id,
      date: date ? new Date(date) : new Date(),
      bankReference: bankReference || null,
      movementType: movementType || null,
      deposit: deposit !== undefined && deposit !== null && deposit !== "" ? parseFloat(deposit) : null,
      withdrawal: withdrawal !== undefined && withdrawal !== null && withdrawal !== "" ? parseFloat(withdrawal) : null,
      concept: concept || null,
      provider: provider || null,
      reference: reference || null,
      invoiceUuid: invoiceUuid || null,
      taxRate: taxRate !== undefined && taxRate !== null && taxRate !== "" ? parseFloat(taxRate) : null,
      salesType: salesType || null,
      incomeCategories: incomeCategories ?? null,
      expenseCategories: expenseCategories ?? null,
      notes: notes || null,
      order: count,
    },
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
