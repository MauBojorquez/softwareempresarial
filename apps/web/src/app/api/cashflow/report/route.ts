import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const accounts = await db.cashFlowAccount.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: { order: "asc" },
    include: { transactions: { orderBy: [{ date: "asc" }, { order: "asc" }] } },
  });

  const categories = await db.cashFlowCategory.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: [{ type: "asc" }, { order: "asc" }],
  });

  const summary = accounts.map((account) => {
    let balance = account.openingBalance;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    for (const tx of account.transactions) {
      totalDeposits += tx.deposit ?? 0;
      totalWithdrawals += tx.withdrawal ?? 0;
    }

    balance = account.openingBalance + totalDeposits - totalWithdrawals;

    const categoryTotals: Record<string, number> = {};
    for (const tx of account.transactions) {
      const incomeCats = (tx.incomeCategories as Record<string, number> | null) ?? {};
      const expenseCats = (tx.expenseCategories as Record<string, number> | null) ?? {};
      for (const [code, amount] of Object.entries(incomeCats)) {
        categoryTotals[code] = (categoryTotals[code] ?? 0) + (amount as number);
      }
      for (const [code, amount] of Object.entries(expenseCats)) {
        categoryTotals[code] = (categoryTotals[code] ?? 0) + (amount as number);
      }
    }

    return {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      openingBalance: account.openingBalance,
      totalDeposits,
      totalWithdrawals,
      currentBalance: balance,
      categoryTotals,
      transactionCount: account.transactions.length,
    };
  });

  const globalCategoryTotals: Record<string, number> = {};
  for (const acc of summary) {
    for (const [code, amount] of Object.entries(acc.categoryTotals)) {
      globalCategoryTotals[code] = (globalCategoryTotals[code] ?? 0) + amount;
    }
  }

  const totalDeposits = summary.reduce((s, a) => s + a.totalDeposits, 0);
  const totalWithdrawals = summary.reduce((s, a) => s + a.totalWithdrawals, 0);
  const totalBalance = summary.reduce((s, a) => s + a.currentBalance, 0);

  return NextResponse.json({
    accounts: summary,
    categories,
    totals: {
      totalDeposits,
      totalWithdrawals,
      totalBalance,
      categoryTotals: globalCategoryTotals,
    },
  });
}
