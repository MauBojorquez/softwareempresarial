/**
 * Cobranza — single source of truth for a receivable's DERIVED status.
 *
 * Status is NEVER stored. It is computed from the receivable's `pagado` flag and
 * its issue date. Use `receivableStatus` and `saldo` everywhere the status /
 * remaining balance is needed so the API, the UI and the dashboard always agree.
 */

export type CobranzaStatus = "PENDIENTE" | "PAGADA" | "VENCIDA";

/** Days after issueDate at which an unpaid receivable becomes overdue. */
export const OVERDUE_DAYS = 30;
const OVERDUE_MS = OVERDUE_DAYS * 24 * 60 * 60 * 1000;

/** Remaining balance for a receivable: full amount if unpaid, 0 if paid. */
export function saldo(amount: number, pagado: boolean): number {
  return pagado ? 0 : amount;
}

/**
 * Derives the display status of a receivable.
 *
 * Rules:
 *  - Marked paid → "PAGADA".
 *  - Not paid AND issued more than 30 days ago → "VENCIDA".
 *  - Otherwise → "PENDIENTE".
 */
export function receivableStatus(pagado: boolean, issueDate: Date): CobranzaStatus {
  if (pagado) return "PAGADA";
  const overdue = Date.now() - new Date(issueDate).getTime() > OVERDUE_MS;
  if (overdue) return "VENCIDA";
  return "PENDIENTE";
}
