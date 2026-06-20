import { db } from "@/server/db";
import { ALL_CATEGORIES, type MetricCategoryKey } from "@/lib/metric-templates";

export type CellMapping = {
  row: number;        // 0-based row index in the grid
  col: number;        // 0-based column index
  category: MetricCategoryKey;
  name: string;       // metric name in the software
  unit: string;
  value: number;      // value read from the uploaded CSV at import time
};

export type SheetMeta = { provider: "spreadsheet_csv"; mappings: CellMapping[] };

function startOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Upserts the mapped cell values (read from a manually uploaded CSV) as metrics
 * for the current month. The values are computed client-side from the user's
 * exported spreadsheet — nothing is fetched from the network here.
 */
export async function upsertSheetMetrics(
  organizationId: string,
  mappings: CellMapping[]
): Promise<{ synced: number }> {
  const period = startOfMonth();
  let synced = 0;

  for (const m of mappings) {
    if (!ALL_CATEGORIES.includes(m.category)) continue;
    if (typeof m.value !== "number" || !Number.isFinite(m.value)) continue;

    const existing = await db.metric.findFirst({
      where: { organizationId, category: m.category, name: m.name, period, source: "SPREADSHEET" },
    });
    if (existing) {
      await db.metric.update({ where: { id: existing.id }, data: { value: m.value, unit: m.unit || null } });
    } else {
      await db.metric.create({
        data: { organizationId, category: m.category, name: m.name, value: m.value, unit: m.unit || null, period, source: "SPREADSHEET" },
      });
    }
    synced++;
  }

  return { synced };
}
