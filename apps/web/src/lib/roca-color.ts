export type RocaColor = "VERDE" | "AMARILLO" | "ROJO";

/**
 * Derives a roca's color from its timeline and progress. This is the single
 * source of truth for a roca's color — it is never set manually.
 *
 *  - porcentajeAvance >= 100 → VERDE (done, even if late).
 *  - past its fechaLimite and not complete → ROJO.
 *  - otherwise compare progress against elapsed time: a roca keeping pace
 *    (ratio >= 1) is VERDE, slightly behind (>= 0.7) is AMARILLO, else ROJO.
 *    A brand-new roca (≈0 elapsed time) is VERDE — nothing to be behind on yet.
 */
export function rocaColor(
  createdAt: Date,
  fechaLimite: Date,
  porcentajeAvance: number,
): RocaColor {
  if (porcentajeAvance >= 100) return "VERDE";

  const now = Date.now();
  if (now > fechaLimite.getTime()) return "ROJO";

  const windowMs = fechaLimite.getTime() - createdAt.getTime();
  const elapsedPct =
    windowMs <= 0 ? 0 : ((now - createdAt.getTime()) / windowMs) * 100;

  const ratio = elapsedPct > 0 ? porcentajeAvance / elapsedPct : 1;

  if (ratio >= 1) return "VERDE";
  if (ratio >= 0.7) return "AMARILLO";
  return "ROJO";
}
