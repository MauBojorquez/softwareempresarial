/**
 * Cobranza — single source of truth for a receivable's DERIVED status.
 *
 * Status is NEVER stored. It is computed from the receivable's amount, the sum
 * of its confirmed payments (abonos), and its issue date. Use `receivableStatus`
 * and `saldo` everywhere the status/remaining balance is needed so the API, the
 * UI and the dashboard always agree.
 */

export type CobranzaStatus = "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA";

/** Days after issueDate at which an unpaid/partial receivable becomes overdue. */
export const OVERDUE_DAYS = 30;
const OVERDUE_MS = OVERDUE_DAYS * 24 * 60 * 60 * 1000;

/** Remaining balance for a receivable (never negative). */
export function saldo(amount: number, paidTotal: number): number {
  return Math.max(0, amount - paidTotal);
}

/**
 * Derives the display status of a receivable.
 *
 * Rules:
 *  - Fully paid (paidTotal >= amount && amount > 0) → "PAGADA".
 *  - Not fully paid AND issued more than 30 days ago → "VENCIDA"
 *    (overrides PENDIENTE / PARCIAL).
 *  - Otherwise: some payment (0 < paidTotal < amount) → "PARCIAL",
 *    no payment (paidTotal == 0) → "PENDIENTE".
 */
export function receivableStatus(
  amount: number,
  paidTotal: number,
  issueDate: Date,
): CobranzaStatus {
  if (amount > 0 && paidTotal >= amount) return "PAGADA";

  const overdue = Date.now() - new Date(issueDate).getTime() > OVERDUE_MS;
  if (overdue) return "VENCIDA";

  if (paidTotal > 0) return "PARCIAL";
  return "PENDIENTE";
}
