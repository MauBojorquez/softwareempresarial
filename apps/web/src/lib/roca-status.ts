import { db } from "@/server/db";
import { notify } from "@/server/services/push/notify";
import { rocaColor, type RocaColor } from "@/lib/roca-color";

const LABEL: Record<RocaColor, string> = {
  VERDE: "en verde",
  AMARILLO: "en amarillo",
  ROJO: "en rojo",
};

/**
 * Recomputes a roca's derived color, persists it when it changed, and — when it
 * transitions INTO amarillo or rojo — pushes a best-effort alert to every
 * Dirección member and the roca's dueño. Returns the current color (null when
 * the roca doesn't exist in the org). Never throws for notification failures.
 */
export async function syncRocaColor(
  orgId: string,
  rocaId: string,
): Promise<RocaColor | null> {
  const roca = await db.roca.findFirst({
    where: { id: rocaId, organizationId: orgId },
    select: {
      id: true,
      titulo: true,
      estatus: true,
      createdAt: true,
      fechaLimite: true,
      porcentajeAvance: true,
      duenoId: true,
    },
  });
  if (!roca) return null;

  const oldColor = roca.estatus as RocaColor;
  const newColor = rocaColor(roca.createdAt, roca.fechaLimite, roca.porcentajeAvance);

  if (newColor !== roca.estatus) {
    await db.roca.update({ where: { id: rocaId }, data: { estatus: newColor } });
  }

  // Alert only on a transition INTO amarillo or rojo.
  if ((newColor === "AMARILLO" || newColor === "ROJO") && newColor !== oldColor) {
    try {
      const direccion = await db.membership.findMany({
        where: { organizationId: orgId, jobRole: "DIRECCION" },
        select: { userId: true },
      });
      const recipients = new Set<string>(direccion.map((m) => m.userId));
      if (roca.duenoId) recipients.add(roca.duenoId);
      await Promise.all(
        [...recipients].map((uid) =>
          notify({
            userId: uid,
            title: `Roca ${LABEL[newColor]}`,
            message: roca.titulo,
            type: "roca",
            url: "/dashboard/rocas",
          }),
        ),
      );
    } catch (e) {
      console.error("roca color push notify failed:", e);
    }
  }

  return newColor;
}
