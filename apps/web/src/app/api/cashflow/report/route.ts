import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";
import { monthRangeMX, currentMonthMX } from "@/lib/day";

export const dynamic = "force-dynamic";

const EMPTY = {
  accounts: [],
  categories: [],
  totals: { totalDeposits: 0, totalWithdrawals: 0, totalBalance: 0, categoryTotals: {} },
  grandTotalDeposits: 0,
  grandTotalWithdrawals: 0,
  grandBalance: 0,
};

export async function GET(req: NextRequest) {
  try {
    const access = await requireAccess(req, "flujo");
    if (access instanceof NextResponse) return access;
    const { orgId } = access;

    // Reconcile cashflow → finance metrics in the background so existing
    // transactions (entered before the sync existed) show up in Finanzas
    // without needing a manual edit. Fire-and-forget; never blocks the report.
    void syncCashflowMetrics(orgId).catch(() => {});

    const mes = req.nextUrl.searchParams.get("mes") || currentMonthMX();
    const { start, end } = monthRangeMX(mes);

    const [accounts, categories, settings] = await Promise.all([
      db.cashFlowAccount.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { order: "asc" },
        include: { transactions: true },
      }),
      db.cashFlowCategory.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { order: "asc" },
      }),
      db.cashFlowSettings.findUnique({ where: { organizationId: orgId } }),
    ]);

    // Per-account summaries for the selected month (carried saldo inicial +
    // per-account category totals + tx count for that month only).
    const accountSummaries = accounts.map((acc) => {
      // saldoInicial carried from movements strictly before the month start.
      const before = acc.transactions.filter((t) => t.date < start);
      const saldoInicial =
        acc.openingBalance +
        before.reduce((s, t) => s + (t.deposit ?? 0) - (t.withdrawal ?? 0), 0);

      const monthTx = acc.transactions.filter((t) => t.date >= start && t.date < end);
      const totalDeposits = monthTx.reduce((s, t) => s + (t.deposit ?? 0), 0);
      const totalWithdrawals = monthTx.reduce((s, t) => s + (t.withdrawal ?? 0), 0);
      const accCategoryTotals: Record<string, number> = {};
      for (const tx of monthTx) {
        const inc = (tx.incomeCategories ?? {}) as Record<string, number>;
        const exp = (tx.expenseCategories ?? {}) as Record<string, number>;
        for (const [code, amt] of Object.entries(inc)) accCategoryTotals[code] = (accCategoryTotals[code] ?? 0) + (amt ?? 0);
        for (const [code, amt] of Object.entries(exp)) accCategoryTotals[code] = (accCategoryTotals[code] ?? 0) + (amt ?? 0);
      }
      return {
        id: acc.id,
        name: acc.name,
        bankName: acc.bankName ?? undefined,
        openingBalance: saldoInicial,
        totalDeposits,
        totalWithdrawals,
        currentBalance: saldoInicial + totalDeposits - totalWithdrawals,
        categoryTotals: accCategoryTotals,
        transactionCount: monthTx.length,
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
      mes,
      closedThroughMes: settings?.closedThroughMes ?? null,
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
