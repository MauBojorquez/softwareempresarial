import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: user.organizationId, category: "FINANCE" },
    orderBy: { date: "desc" },
    take: 10,
  });

  const find = (name: string) => metrics.find((m) => m.name === name);

  return NextResponse.json({
    income: find("income")?.value ?? 620000,
    incomeChange: 10.7,
    expenses: find("expenses")?.value ?? 360000,
    expensesChange: 2.9,
    netProfit: find("net_profit")?.value ?? 260000,
    netProfitChange: 22.4,
    cashFlow: find("cash_flow")?.value ?? 180000,
    cashFlowChange: 8.1,
  });
}
