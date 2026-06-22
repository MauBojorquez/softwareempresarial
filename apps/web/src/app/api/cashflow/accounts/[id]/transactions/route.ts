import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { activeOrgId: true } });
  return user?.activeOrgId ?? null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await db.cashFlowAccount.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const transactions = await db.cashFlowTransaction.findMany({
    where: { accountId: params.id },
    orderBy: [{ date: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
  // Compute running balance
  let balance = account.openingBalance;
  const rows = transactions.map(t => {
    balance += (t.deposit ?? 0) - (t.withdrawal ?? 0);
    return { ...t, balance };
  });
  return NextResponse.json({ account, transactions: rows });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await db.cashFlowAccount.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const count = await db.cashFlowTransaction.count({ where: { accountId: params.id } });
  const tx = await db.cashFlowTransaction.create({
    data: {
      accountId: params.id,
      date: body.date ? new Date(body.date) : new Date(),
      bankReference: body.bankReference,
      movementType: body.movementType,
      deposit: body.deposit,
      withdrawal: body.withdrawal,
      concept: body.concept,
      provider: body.provider,
      reference: body.reference,
      invoiceUuid: body.invoiceUuid,
      taxRate: body.taxRate,
      salesType: body.salesType,
      incomeCategories: body.incomeCategories,
      expenseCategories: body.expenseCategories,
      notes: body.notes,
      order: count,
    },
  });
  return NextResponse.json({ transaction: tx });
}
