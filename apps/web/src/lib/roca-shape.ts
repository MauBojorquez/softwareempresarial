import { db } from "@/server/db";

/**
 * Loads a roca by id and returns the API shape used by the rocas UI,
 * including its checklist items. porcentajeAvance stays the source of truth
 * for the progress bar (derived when usaChecklist).
 */
export async function shapeRocaWithChecklist(id: string) {
  const r = await db.roca.findFirstOrThrow({
    where: { id },
    include: {
      dueno: { select: { name: true, email: true } },
      checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  return {
    id: r.id,
    titulo: r.titulo,
    metricaExito: r.metricaExito,
    fechaLimite: r.fechaLimite,
    estatus: r.estatus,
    porcentajeAvance: r.porcentajeAvance,
    usaChecklist: r.usaChecklist,
    mes: r.mes,
    duenoId: r.duenoId,
    duenoNombre: r.dueno?.name ?? r.dueno?.email ?? null,
    checklist: r.checklist.map((i) => ({
      id: i.id,
      titulo: i.titulo,
      done: i.done,
      order: i.order,
    })),
  };
}
