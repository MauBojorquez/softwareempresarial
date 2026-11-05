import { Prisma } from "@prisma/client";

/** Strict "YYYY-MM" with a real month 01–12. */
export function isValidMes(mes: unknown): mes is string {
  return typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

type Parsed<T> = { ok: true; value: T } | { ok: false };

/**
 * Optional money/rate field: "" / null → null; a finite number (or numeric
 * string) → that number; anything else is invalid. Never yields NaN.
 */
export function parseAmount(v: unknown): Parsed<number | null> {
  if (v === "" || v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "number" && typeof v !== "string") return { ok: false };
  if (typeof v === "string" && !v.trim()) return { ok: true, value: null };
  const n = Number(v);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

/**
 * Category split `{ CODE: amount }`. null/"" → DB null; every value must be a
 * finite number (empty values are dropped).
 */
export function parseCategories(
  v: unknown,
): Parsed<Prisma.InputJsonObject | typeof Prisma.DbNull> {
  if (v === null || v === "" || v === undefined) return { ok: true, value: Prisma.DbNull };
  if (typeof v !== "object" || Array.isArray(v)) return { ok: false };
  const out: Record<string, number> = {};
  for (const [code, raw] of Object.entries(v as Record<string, unknown>)) {
    const amt = parseAmount(raw);
    if (!amt.ok) return { ok: false };
    if (amt.value !== null) out[code] = amt.value;
  }
  return { ok: true, value: out };
}

export type TxNumericFields = {
  deposit?: number | null;
  withdrawal?: number | null;
  taxRate?: number | null;
  incomeCategories?: Prisma.InputJsonObject | typeof Prisma.DbNull;
  expenseCategories?: Prisma.InputJsonObject | typeof Prisma.DbNull;
};

/**
 * Validates the numeric fields of a transaction body. Only keys present in the
 * body (not undefined) end up in `data`, so it serves both create and update.
 */
export function parseTxNumericFields(
  body: Record<string, unknown>,
): { ok: true; data: TxNumericFields } | { ok: false; error: string } {
  const data: TxNumericFields = {};
  const amounts = [
    ["deposit", "Depósito inválido"],
    ["withdrawal", "Retiro inválido"],
    ["taxRate", "Tasa de impuesto inválida"],
  ] as const;
  for (const [key, error] of amounts) {
    if (body[key] === undefined) continue;
    const r = parseAmount(body[key]);
    if (!r.ok) return { ok: false, error };
    data[key] = r.value;
  }
  for (const key of ["incomeCategories", "expenseCategories"] as const) {
    if (body[key] === undefined) continue;
    const r = parseCategories(body[key]);
    if (!r.ok) return { ok: false, error: "Montos de categoría inválidos" };
    data[key] = r.value;
  }
  return { ok: true, data };
}
