import { db } from "@/server/db";

/**
 * Syncs cashflow transaction totals into the Metric table so the finance
 * dashboard reflects real bank movements. Each call re-computes all months
 * from scratch for the org and replaces previous cashflow-sourced metrics.
 *
 * Metrics written (canonical FINANCE card names so the dashboard cards pick
 * them up directly — see CATEGORY_TEMPLATES.FINANCE):
 *   name: "Ingresos"  category: FINANCE  metadata.cashflow: true  — total deposits per month
 *   name: "Gastos"    category: FINANCE  metadata.cashflow: true  — total withdrawals per month
 *
 * "Flujo de Caja" is a computed card (Ingresos - Gastos) so it updates
 * automatically once these two move.
 *
 * The delete + insert run inside a single transaction so concurrent reads
 * (the dashboard reconciles on every load) never observe a moment where the
 * cashflow rows are missing.
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

  // Build fresh monthly totals before touching the DB
  const rows: {
    organizationId: string;
    category: "FINANCE";
    name: string;
    value: number;
    unit: string;
    period: Date;
    metadata: { cashflow: true };
  }[] = [];
  for (const { deposits, withdrawals, period } of byMonth.values()) {
    if (deposits > 0) {
      rows.push({
        organizationId: orgId,
        category: "FINANCE",
        name: "Ingresos",
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
        name: "Gastos",
        value: withdrawals,
        unit: "MXN",
        period,
        metadata: { cashflow: true },
      });
    }
  }

  // Atomic swap: delete previously synced cashflow metrics and insert the
  // fresh ones in one transaction so readers never see an empty window.
  const deleteOp = db.metric.deleteMany({
    where: {
      organizationId: orgId,
      category: "FINANCE",
      metadata: { path: ["cashflow"], equals: true },
    },
  });

  if (rows.length > 0) {
    await db.$transaction([deleteOp, db.metric.createMany({ data: rows })]);
  } else {
    await deleteOp;
  }
}
