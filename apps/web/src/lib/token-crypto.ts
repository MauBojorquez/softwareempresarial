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
