// Shared validation/normalization for optional lead contact fields.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Validate/normalize an optional email. Empty/omitted → null.
 * When present it must match a basic email regex. Stored trimmed + lowercased.
 */
export function parseEmail(raw: unknown): ContactResult<string | null> {
  if (raw == null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };
  const value = s.toLowerCase();
  if (!EMAIL_RE.test(value)) return { ok: false, error: "Correo inválido" };
  return { ok: true, value };
}

/**
 * Validate/normalize an optional phone. Empty/omitted → null.
 * Strips spaces, dashes, parens; keeps an optional leading "+".
 * Digits (ignoring a leading +) must be exactly 10 (local w/ lada) OR
 * 11-15 when a leading + (country code) is present.
 */
export function parsePhone(raw: unknown): ContactResult<string | null> {
  if (raw == null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };

  const hasPlus = s.startsWith("+");
  const stripped = s.replace(/[\s\-()]/g, "");
  const digits = hasPlus ? stripped.slice(1) : stripped;

  const err = { ok: false as const, error: "Teléfono inválido (incluye la lada, ej. 55 1234 5678)" };
  if (!/^\d+$/.test(digits)) return err;

  const valid = digits.length === 10 || (hasPlus && digits.length >= 11 && digits.length <= 15);
  if (!valid) return err;

  return { ok: true, value: (hasPlus ? "+" : "") + digits };
}

/**
 * Returns the last 10 digits of a phone (the local core, ignoring country code
 * and any formatting) for tolerant lookups. Null when fewer than 10 digits.
 * Used to match a lead by phone regardless of how it was stored.
 */
export function phoneCore(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}
