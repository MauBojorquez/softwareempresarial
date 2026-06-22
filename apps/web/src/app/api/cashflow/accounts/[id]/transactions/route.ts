import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrganizationId(req);
    if (!orgId) return NextResponse.json({ transactions: [] });
    const account = await db.cashFlowAccount.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const transactions = await db.cashFlowTransaction.findMany({
      where: { accountId: params.id },
      orderBy: [{ date: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    // Compute running balance
    let balance = account.openingBalance;
    const rows = transactions.map((t) => {
      balance += (t.deposit ?? 0) - (t.withdrawal ?? 0);
      return { ...t, balance };
    });
    return NextResponse.json({ account, transactions: rows });
  } catch (err) {
    console.error("cashflow transactions GET error:", err);
    return NextResponse.json({ transactions: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrganizationId(req);
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 401 });
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
        deposit: body.deposit === "" || body.deposit === null ? null : body.deposit !== undefined ? Number(body.deposit) : null,
        withdrawal: body.withdrawal === "" || body.withdrawal === null ? null : body.withdrawal !== undefined ? Number(body.withdrawal) : null,
        concept: body.concept,
        provider: body.provider,
        reference: body.reference,
        invoiceUuid: body.invoiceUuid,
        taxRate: body.taxRate === "" || body.taxRate === null ? null : body.taxRate !== undefined ? Number(body.taxRate) : null,
        salesType: body.salesType,
        incomeCategories: body.incomeCategories,
        expenseCategories: body.expenseCategories,
        notes: body.notes,
        order: count,
      },
    });
    // Fire-and-forget sync — don't block the response
    syncCashflowMetrics(orgId).catch(console.error);
    return NextResponse.json({ transaction: tx });
  } catch (err) {
    console.error("cashflow transactions POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
