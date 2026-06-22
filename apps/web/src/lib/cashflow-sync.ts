import { db } from "@/server/db";

/**
 * Syncs cashflow transaction totals into the Metric table so the finance
 * dashboard reflects real bank movements. Each call re-computes all months
 * from scratch for the org and replaces previous cashflow-sourced metrics.
 *
 * Metrics written:
 *   name: "Ingreso"  category: FINANCE  metadata.cashflow: true  — total deposits per month
 *   name: "Egreso"   category: FINANCE  metadata.cashflow: true  — total withdrawals per month
 *
 * The dashboard sums FINANCE metrics matching "ingreso"/"egreso" keywords
 * (when SAT is not connected), so these automatically populate the cards.
 */
export async function syncCashflowMetrics(orgId: string): Promise<void> {
  // Fetch all active accounts + their transactions for this org
  const accounts = await db.cashFlowAccount.findMany({
    where: { organizationId: orgId, isActive: true },
    include: { transactions: { select: { date: true, deposit: true, withdrawal: true } } },
  });

  // Aggregate by month (UTC)
  const byMonth = new Map<string, { deposits: number; withdrawals: number; period: Date }>();

  for (const acc of accounts) {
    for (const tx of acc.transactions) {
      const d = tx.date;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(key) ?? {
        deposits: 0,
        withdrawals: 0,
        period: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
      };
      existing.deposits += tx.deposit ?? 0;
      existing.withdrawals += tx.withdrawal ?? 0;
      byMonth.set(key, existing);
    }
  }

  // Delete all previously synced cashflow metrics for this org
  await db.metric.deleteMany({
    where: {
      organizationId: orgId,
      category: "FINANCE",
      metadata: { path: ["cashflow"], equals: true },
    },
  });

  if (byMonth.size === 0) return;

  // Insert fresh monthly totals
  const rows: Parameters<typeof db.metric.createMany>[0]["data"] = [];
  for (const { deposits, withdrawals, period } of byMonth.values()) {
    if (deposits > 0) {
      rows.push({
        organizationId: orgId,
        category: "FINANCE",
        name: "Ingreso",
        value: deposits,
        unit: "MXN",
        period,
        metadata: { cashflow: true },
      });
    }
    if (withdrawals > 0) {
      rows.push({
        organizationId: orgId,
        category: "FINANCE",
        name: "Egreso",
        value: withdrawals,
        unit: "MXN",
        period,
        metadata: { cashflow: true },
      });
    }
  }

  if (rows.length > 0) {
    await db.metric.createMany({ data: rows });
  }
}
