import { db } from "@/server/db";

/**
 * Recomputes a checklist roca's porcentajeAvance from its items and persists it.
 * Derived = round(done / total * 100), 0 when there are no items. Existing
 * readers (dashboard, resumen) keep working off porcentajeAvance.
 */
export async function recomputeRocaProgress(rocaId: string): Promise<number> {
  const items = await db.rocaChecklistItem.findMany({
    where: { rocaId },
    select: { done: true },
  });
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  await db.roca.update({ where: { id: rocaId }, data: { porcentajeAvance: pct } });
  return pct;
}
