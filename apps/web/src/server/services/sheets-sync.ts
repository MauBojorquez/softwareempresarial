import { db } from "@/server/db";
import { fetchSheetGrid, parseCellNumber } from "@/lib/google-sheets";
import { ALL_CATEGORIES, type MetricCategoryKey } from "@/lib/metric-templates";

export type CellMapping = {
  row: number;        // 0-based row index in the grid
  col: number;        // 0-based column index
  category: MetricCategoryKey;
  name: string;       // metric name in the software
  unit: string;
};

export type SheetMeta = { provider: "google_sheets"; url: string; mappings: CellMapping[] };

function startOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Reads the org's connected Google Sheet and upserts the mapped cells as
 * metrics for the current month. Returns counts. Safe to call repeatedly.
 */
export async function syncSheetForOrg(organizationId: string): Promise<{ synced: number; error?: string }> {
  const integration = await db.integration.findFirst({
    where: { organizationId, type: "CUSTOM_API", isActive: true },
  });
  if (!integration) return { synced: 0, error: "No hay hoja conectada" };

  const meta = integration.metadata as unknown as SheetMeta | null;
  if (!meta?.url || !Array.isArray(meta.mappings) || meta.mappings.length === 0) {
    return { synced: 0, error: "Conexión sin mapeos" };
  }

  const result = await fetchSheetGrid(meta.url);
  if (!result.ok) return { synced: 0, error: result.error };

  const grid = result.grid;
  const period = startOfMonth();
  let synced = 0;

  for (const m of meta.mappings) {
    if (!ALL_CATEGORIES.includes(m.category)) continue;
    const raw = grid[m.row]?.[m.col];
    const value = parseCellNumber(raw);
    if (value === null) continue;

    // Upsert the current-month snapshot for this metric (no compound unique key,
    // so do it manually: update existing or create).
    const existing = await db.metric.findFirst({
      where: { organizationId, category: m.category, name: m.name, period, source: "CUSTOM_API" },
    });
    if (existing) {
      await db.metric.update({ where: { id: existing.id }, data: { value, unit: m.unit || null } });
    } else {
      await db.metric.create({
        data: { organizationId, category: m.category, name: m.name, value, unit: m.unit || null, period, source: "CUSTOM_API" },
      });
    }
    synced++;
  }

  await db.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date() } });
  return { synced };
}
