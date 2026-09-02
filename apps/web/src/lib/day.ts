/**
 * Date helpers for the daily-report feature.
 *
 * "Today" for a daily report is defined in America/Mexico_City, not UTC, so
 * that the editable-until-midnight freeze rule matches the local business day
 * regardless of where the server runs.
 */

const MX_TZ = "America/Mexico_City";

/**
 * Returns the current date as "YYYY-MM-DD" in the America/Mexico_City timezone.
 * `en-CA` formats dates as YYYY-MM-DD, so this yields exactly the string used as
 * the DailyReport.fecha key.
 */
export function todayMX(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date());
}

/** True when `fecha` is a valid "YYYY-MM-DD" string. */
export function isValidDate(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

/** Current month "YYYY-MM" in America/Mexico_City (used for velocidad del mes). */
export function currentMonthMX(): string {
  return todayMX().slice(0, 7);
}
