import { db } from "@/server/db";

const QUICKBOOKS_BASE_URL = "https://quickbooks.api.intuit.com/v3";

export async function getQuickBooksClient(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "QUICKBOOKS" } },
  });

  if (!integration || !integration.isActive) {
    throw new Error("QuickBooks integration not found or inactive");
  }

  return {
    accessToken: integration.accessToken,
    realmId: (integration.metadata as { realmId?: string })?.realmId,
  };
}

export async function fetchProfitAndLoss(organizationId: string, startDate: string, endDate: string) {
  const { accessToken, realmId } = await getQuickBooksClient(organizationId);

  const response = await fetch(
    `${QUICKBOOKS_BASE_URL}/company/${realmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) throw new Error(`QuickBooks API error: ${response.status}`);
  return response.json();
}

export async function fetchBalanceSheet(organizationId: string, asOfDate: string) {
  const { accessToken, realmId } = await getQuickBooksClient(organizationId);

  const response = await fetch(
    `${QUICKBOOKS_BASE_URL}/company/${realmId}/reports/BalanceSheet?date_macro=${asOfDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) throw new Error(`QuickBooks API error: ${response.status}`);
  return response.json();
}

export async function fetchCashFlow(organizationId: string, startDate: string, endDate: string) {
  const { accessToken, realmId } = await getQuickBooksClient(organizationId);

  const response = await fetch(
    `${QUICKBOOKS_BASE_URL}/company/${realmId}/reports/CashFlow?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) throw new Error(`QuickBooks API error: ${response.status}`);
  return response.json();
}

export async function syncFinancialMetrics(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const pnl = await fetchProfitAndLoss(organizationId, startOfMonth, today);

  const revenue = extractRevenueFromPnL(pnl);
  const expenses = extractExpensesFromPnL(pnl);
  const netIncome = revenue - expenses;

  await db.metric.createMany({
    data: [
      { organizationId, category: "FINANCE", name: "revenue", value: revenue, period: now, source: "QUICKBOOKS" },
      { organizationId, category: "FINANCE", name: "expenses", value: expenses, period: now, source: "QUICKBOOKS" },
      { organizationId, category: "FINANCE", name: "net_income", value: netIncome, period: now, source: "QUICKBOOKS" },
    ],
  });
}

function extractRevenueFromPnL(report: Record<string, unknown>): number {
  try {
    const rows = (report as { Rows?: { Row?: Array<{ Summary?: { ColData?: Array<{ value?: string }> }; group?: string }> } }).Rows?.Row ?? [];
    const incomeRow = rows.find((r) => r.group === "Income");
    return parseFloat(incomeRow?.Summary?.ColData?.[1]?.value ?? "0");
  } catch {
    return 0;
  }
}

function extractExpensesFromPnL(report: Record<string, unknown>): number {
  try {
    const rows = (report as { Rows?: { Row?: Array<{ Summary?: { ColData?: Array<{ value?: string }> }; group?: string }> } }).Rows?.Row ?? [];
    const expenseRow = rows.find((r) => r.group === "Expenses");
    return parseFloat(expenseRow?.Summary?.ColData?.[1]?.value ?? "0");
  } catch {
    return 0;
  }
}
