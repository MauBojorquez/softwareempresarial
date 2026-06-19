import { db } from "@/server/db";
import {
  fetchInvoices,
  groupInvoicesByMonth,
} from "./facturapi-service";

/**
 * Fetches the last 3 months of CFDIs from Facturapi for the given org,
 * upserts Metric records grouped by month, and updates SatCredential status.
 */
export async function syncSatMetrics(organizationId: string): Promise<void> {
  const credential = await db.satCredential.findUnique({
    where: { organizationId },
  });

  if (!credential) {
    throw new Error("No SAT credential found for this organization");
  }

  // Mark as syncing
  await db.satCredential.update({
    where: { organizationId },
    data: { syncStatus: "syncing" },
  });

  try {
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - 3);

    const invoices = await fetchInvoices(
      credential.facturapiOrgId,
      dateFrom,
      dateTo,
    );

    const months = groupInvoicesByMonth(invoices);

    // Upsert metrics — we use a composite "find by name+period+org" approach
    for (const month of months) {
      const baseData = {
        organizationId,
        category: "FINANCE" as const,
        source: "SAT" as const,
        unit: "MXN",
        period: month.period,
      };

      const upsertMetric = async (name: string, value: number) => {
        const existing = await db.metric.findFirst({
          where: { organizationId, name, period: month.period, source: "SAT" },
        });

        if (existing) {
          await db.metric.update({
            where: { id: existing.id },
            data: { value },
          });
        } else {
          await db.metric.create({
            data: { ...baseData, name, value },
          });
        }
      };

      await Promise.all([
        upsertMetric("Ingresos", month.ingresos),
        upsertMetric("Egresos", month.egresos),
        upsertMetric("Balance Fiscal", month.balance),
        upsertMetric("IVA Cobrado", month.ivaCobrado),
      ]);
    }

    // Mark synced
    await db.satCredential.update({
      where: { organizationId },
      data: {
        syncStatus: "synced",
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al sincronizar";
    await db.satCredential.update({
      where: { organizationId },
      data: { syncStatus: "error", lastError: message },
    });
    throw err;
  }
}
