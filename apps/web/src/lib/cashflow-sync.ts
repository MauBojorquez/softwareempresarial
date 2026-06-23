import { db } from "@/server/db";

/**
 * Finance is presented as two INDEPENDENT blocks that are never summed, so the
 * numbers can't double-count:
 *
 *   • Fiscal (SAT)        → FINANCE Metric rows with source "SAT" (facturado, IVA)
 *   • Flujo de Efectivo   → read directly from the CashFlow* tables wherever shown
 *                           (overview "Caja" block + the cashflow module/banner)
 *
 * Earlier we mirrored cashflow totals into FINANCE Metric rows named
 * "Ingresos"/"Gastos". That made every keyword-summing consumer add SAT +
 * cashflow together and double-count money that was both invoiced and deposited.
 *
 * This function now PURGES those mirrored rows. Keeping the name/signature means
 * every existing call site (transaction mutations, report load, dashboard read)
 * simply cleans up legacy rows instead of creating double-counting ones — no
 * other code needs to change, and any rows written before this deploy are
 * removed on the next read. It is cheap and idempotent (a no-op once gone).
 */
export async function syncCashflowMetrics(orgId: string): Promise<void> {
  await db.metric.deleteMany({
    where: {
      organizationId: orgId,
      category: "FINANCE",
      metadata: { path: ["cashflow"], equals: true },
    },
  });
}
