import type { Salud } from "@prisma/client";

/**
 * Group "salud" as the AVERAGE of the members' colors (VERDE=100, AMARILLO=50,
 * ROJO=0), not worst-case. Callers must pass counts of NON-BAJA members only —
 * BAJA clients have no color and are excluded from the average and the counts.
 * Returns null when there are zero members (sin color / sin datos).
 */
export function saludGrupoFromCounts(counts: {
  verde: number;
  amarillo: number;
  rojo: number;
}): Salud | null {
  const total = counts.verde + counts.amarillo + counts.rojo;
  if (total === 0) return null;
  const avg = (counts.verde * 100 + counts.amarillo * 50) / total;
  if (avg >= 66.67) return "VERDE";
  if (avg >= 33.34) return "AMARILLO";
  return "ROJO";
}
