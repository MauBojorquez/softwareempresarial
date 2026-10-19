import crypto from "crypto";

// AES-256-GCM for secrets at rest (Google refresh tokens). The key is derived
// from GOOGLE_TOKEN_KEY (any long random string) with SHA-256.
function key(): Buffer {
  const secret = process.env.GOOGLE_TOKEN_KEY;
  if (!secret || secret.length < 16) throw new Error("GOOGLE_TOKEN_KEY no está configurada");
  return crypto.createHash("sha256").update(secret).digest();
}

/** Returns "iv.tag.ciphertext" in base64url. */
export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ─── Signed OAuth state ─────────────────────────────────────────────
// The state carries the userId, an expiry and a nonce, HMAC-signed with
// NEXTAUTH_SECRET. It does not depend on cookies, so the flow survives the
// mobile case where Google returns to a different browser than the one that
// started it (installed app → Safari).

function stateKey(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET no está configurada");
  return s;
}

export function signState(userId: string, ttlMs = 15 * 60_000): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, e: Date.now() + ttlMs, n: crypto.randomBytes(8).toString("hex") }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the userId when the state is authentic and not expired, else null. */
export function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u?: string; e?: number };
    if (!data.u || !data.e || Date.now() > data.e) return null;
    return data.u;
  } catch {
    return null;
  }
}
