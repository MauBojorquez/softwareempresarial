import { db } from "@/server/db";
import { decryptToken } from "@/lib/token-crypto";

// Read-only access to the user's own mailbox and Drive (for Meet/Gemini notes).
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];
export const REQUIRED_SCOPES = GOOGLE_SCOPES.slice(2);

// A dedicated OAuth client can be used for Workspace data; otherwise the login
// client ("Iniciar con Google") is reused.
export function googleClient() {
  const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltan las credenciales de Google (GOOGLE_CLIENT_ID/SECRET)");
  return { clientId, clientSecret, redirectUri: `${process.env.NEXTAUTH_URL}/api/google/callback` };
}

/**
 * Exchanges the stored refresh token for a short-lived access token. Records
 * the failure on the connection (e.g. the user revoked access) and returns null.
 */
export async function getAccessToken(userId: string): Promise<{ token: string; googleEmail: string } | null> {
  const conn = await db.googleConnection.findUnique({ where: { userId } });
  if (!conn) return null;
  try {
    const { clientId, clientSecret } = googleClient();
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptToken(conn.refreshTokenEnc),
        grant_type: "refresh_token",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
    if (!res.ok || !data.access_token) throw new Error(data.error || `token ${res.status}`);
    await db.googleConnection.update({
      where: { userId },
      data: { lastUsedAt: new Date(), lastError: null },
    });
    return { token: data.access_token, googleEmail: conn.googleEmail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.googleConnection.update({ where: { userId }, data: { lastError: msg.slice(0, 300) } }).catch(() => {});
    console.error("[google] access token failed for", userId, msg);
    return null;
  }
}
