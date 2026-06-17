import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: orgId, category: "FINANCE" },
    orderBy: { period: "desc" },
    take: 30,
  });

  const latest = (name: string) => metrics.find((m) => m.name === name);
  const previous = (name: string) => metrics.filter((m) => m.name === name)[1];

  const calc = (name: string) => {
    const curr = latest(name);
    const prev = previous(name);
    const value = curr?.value ?? 0;
    const change = prev ? ((value - prev.value) / prev.value) * 100 : 0;
    return { value, change: parseFloat(change.toFixed(1)) };
  };

  const income = calc("income");
  const expenses = calc("expenses");
  const netProfit = calc("net_profit");
  const cashFlow = calc("cash_flow");

  return NextResponse.json({
    income: income.value,
    incomeChange: income.change,
    expenses: expenses.value,
    expensesChange: expenses.change,
    netProfit: netProfit.value,
    netProfitChange: netProfit.change,
    cashFlow: cashFlow.value,
    cashFlowChange: cashFlow.change,
  });
}
