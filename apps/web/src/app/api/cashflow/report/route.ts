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

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [accounts, categories] = await Promise.all([
    db.cashFlowAccount.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { order: "asc" },
      include: { transactions: true },
    }),
    db.cashFlowCategory.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const accountSummaries = accounts.map(acc => {
    const totalDeposits = acc.transactions.reduce((s, t) => s + (t.deposit ?? 0), 0);
    const totalWithdrawals = acc.transactions.reduce((s, t) => s + (t.withdrawal ?? 0), 0);
    return {
      id: acc.id,
      name: acc.name,
      openingBalance: acc.openingBalance,
      totalDeposits,
      totalWithdrawals,
      currentBalance: acc.openingBalance + totalDeposits - totalWithdrawals,
    };
  });

  // Aggregate category totals across all transactions
  const allTx = accounts.flatMap(a => a.transactions);
  const catTotals: Record<string, { income: number; expense: number }> = {};
  for (const tx of allTx) {
    const inc = (tx.incomeCategories ?? {}) as Record<string, number>;
    const exp = (tx.expenseCategories ?? {}) as Record<string, number>;
    for (const [code, amt] of Object.entries(inc)) {
      catTotals[code] = catTotals[code] ?? { income: 0, expense: 0 };
      catTotals[code].income += amt;
    }
    for (const [code, amt] of Object.entries(exp)) {
      catTotals[code] = catTotals[code] ?? { income: 0, expense: 0 };
      catTotals[code].expense += amt;
    }
  }

  const categorySummaries = categories.map(c => ({
    id: c.id, code: c.code, name: c.name, type: c.type,
    totalIncome: catTotals[c.code]?.income ?? 0,
    totalExpense: catTotals[c.code]?.expense ?? 0,
  }));

  const grandTotalDeposits = accountSummaries.reduce((s, a) => s + a.totalDeposits, 0);
  const grandTotalWithdrawals = accountSummaries.reduce((s, a) => s + a.totalWithdrawals, 0);
  const grandBalance = accountSummaries.reduce((s, a) => s + a.currentBalance, 0);

  return NextResponse.json({ accounts: accountSummaries, categories: categorySummaries, grandTotalDeposits, grandTotalWithdrawals, grandBalance });
}
