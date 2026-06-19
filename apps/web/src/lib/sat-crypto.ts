import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM helpers for encrypting taxpayer e.firma (FIEL) credentials.
 *
 * Payload layout (then base64-encoded):
 *   iv (12 bytes) || authTag (16 bytes) || ciphertext
 *
 * SECURITY: never log plaintext, keys, or the contents of the e.firma.
 */

const IV_LENGTH = 12; // GCM standard nonce length
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const hex = process.env.SAT_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "SAT_ENCRYPTION_KEY is not set. Expected 64 hex characters (32 bytes).",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "SAT_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string | Buffer): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const data = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): Buffer {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");

  if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted payload: too short.");
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
