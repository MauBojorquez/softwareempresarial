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

/**
 * Progress of the current MX month: the day-of-month today (1-based), the number
 * of days in the month, and how many days remain INCLUDING today.
 */
export function monthProgressMX(): {
  dayOfMonth: number;
  daysInMonth: number;
  diasRestantes: number;
} {
  const today = todayMX(); // "YYYY-MM-DD"
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1..12
  const dayOfMonth = Number(dayStr);
  // Day 0 of the next month = last day of this month (UTC-safe arithmetic).
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const diasRestantes = daysInMonth - dayOfMonth + 1; // today counts
  return { dayOfMonth, daysInMonth, diasRestantes };
}

/**
 * UTC Date bounds [start, end) that correspond to the given "YYYY-MM" month
 * expressed in America/Mexico_City local time. Because MX is UTC-6 (no DST since
 * 2023), the local month start 00:00 is 06:00 UTC of the same calendar day; we
 * compute the offset dynamically so the range stays correct if rules change.
 */
export function monthRangeMX(mes?: string): { start: Date; end: Date } {
  const m = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonthMX();
  const [yearStr, monthStr] = m.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1..12

  return {
    start: mxLocalMidnightToUTC(year, month, 1),
    end: mxLocalMidnightToUTC(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1),
  };
}

/**
 * Returns the UTC Date for local midnight (00:00 America/Mexico_City) of the
 * given calendar day, computing the timezone offset from the zone itself.
 */
function mxLocalMidnightToUTC(year: number, month: number, day: number): Date {
  // Guess: treat the wall-clock as if it were UTC, then correct by the zone's
  // offset at that instant.
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMs = mxOffsetMs(new Date(guess));
  return new Date(guess + offsetMs);
}

/** Offset in ms to ADD to a UTC instant to get MX local time (negative). */
function mxOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: MX_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  // asUTC - date = local - utc = offset (negative for MX). We want the value to
  // add to a UTC guess to move it back to the real UTC instant of local midnight,
  // which is -offset. Return -(local-utc).
  return -(asUTC - date.getTime());
}
