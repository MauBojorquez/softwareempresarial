import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

const EMPTY = {
  accounts: [],
  categories: [],
  totals: { totalDeposits: 0, totalWithdrawals: 0, totalBalance: 0, categoryTotals: {} },
  grandTotalDeposits: 0,
  grandTotalWithdrawals: 0,
  grandBalance: 0,
};

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { activeOrgId: true } });
  return user?.activeOrgId ?? null;
}

export async function GET() {
  try {
    const orgId = await getOrgId();
    if (!orgId) return NextResponse.json(EMPTY);

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

  // Per-account summaries (including per-account category totals + tx count)
  const accountSummaries = accounts.map((acc) => {
    const totalDeposits = acc.transactions.reduce((s, t) => s + (t.deposit ?? 0), 0);
    const totalWithdrawals = acc.transactions.reduce((s, t) => s + (t.withdrawal ?? 0), 0);
    const categoryTotals: Record<string, number> = {};
    for (const tx of acc.transactions) {
      const inc = (tx.incomeCategories ?? {}) as Record<string, number>;
      const exp = (tx.expenseCategories ?? {}) as Record<string, number>;
      for (const [code, amt] of Object.entries(inc)) categoryTotals[code] = (categoryTotals[code] ?? 0) + (amt ?? 0);
      for (const [code, amt] of Object.entries(exp)) categoryTotals[code] = (categoryTotals[code] ?? 0) + (amt ?? 0);
    }
    return {
      id: acc.id,
      name: acc.name,
      bankName: acc.bankName ?? undefined,
      openingBalance: acc.openingBalance,
      totalDeposits,
      totalWithdrawals,
      currentBalance: acc.openingBalance + totalDeposits - totalWithdrawals,
      categoryTotals,
      transactionCount: acc.transactions.length,
    };
  });

  // Global category totals (sum of income + expense activity per code)
  const categoryTotals: Record<string, number> = {};
  for (const acc of accountSummaries) {
    for (const [code, amt] of Object.entries(acc.categoryTotals)) {
      categoryTotals[code] = (categoryTotals[code] ?? 0) + amt;
    }
  }

  const totalDeposits = accountSummaries.reduce((s, a) => s + a.totalDeposits, 0);
  const totalWithdrawals = accountSummaries.reduce((s, a) => s + a.totalWithdrawals, 0);
  const totalBalance = accountSummaries.reduce((s, a) => s + a.currentBalance, 0);

  const categorySummaries = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    order: c.order,
  }));

  return NextResponse.json({
    accounts: accountSummaries,
    categories: categorySummaries,
    totals: { totalDeposits, totalWithdrawals, totalBalance, categoryTotals },
    // Aliases consumed by the finance dashboard banner
    grandTotalDeposits: totalDeposits,
    grandTotalWithdrawals: totalWithdrawals,
    grandBalance: totalBalance,
  });
  } catch (err) {
    console.error("cashflow/report error:", err);
    return NextResponse.json(EMPTY);
  }
}
