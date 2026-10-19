import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { encryptToken, verifyState } from "@/lib/token-crypto";
import { REQUIRED_SCOPES, appBase, googleClient } from "@/server/services/google/oauth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** Back to Settings with a result code (and a short, non-secret detail). */
function back(status: string, detalle?: string) {
  const qs = new URLSearchParams({ google: status, ...(detalle ? { detalle: detalle.slice(0, 80) } : {}) });
  return NextResponse.redirect(`${appBase()}/dashboard/settings?${qs}`);
}

// GET /api/google/callback — Google redirects here after consent. The user is
// identified by the HMAC-signed `state` (not the browser session), so this
// works even when Google returns to a different browser on mobile.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back("cancelado", sp.get("error") ?? undefined);

  let userId: string | null = null;
  try {
    userId = verifyState(sp.get("state") ?? "");
  } catch {
    return back("error", "config_secreto");
  }
  if (!userId) return back("error", "enlace_vencido");

  const code = sp.get("code");
  if (!code) return back("error", "sin_codigo");

  let client;
  try {
    client = googleClient();
  } catch {
    return back("no_configurado");
  }

  // 1) Exchange the code for tokens.
  let data: { refresh_token?: string; scope?: string; id_token?: string; error?: string; error_description?: string };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: client.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    data = await res.json();
    if (!res.ok) {
      console.error("[google] token exchange failed:", data.error, data.error_description);
      return back("error", `google_${data.error ?? res.status}`);
    }
  } catch (e) {
    console.error("[google] token exchange exception:", e);
    return back("error", "google_sin_respuesta");
  }

  if (!data.refresh_token) return back("error", "sin_refresh_token");

  // 2) Every read-only scope must be granted (the user may untick boxes).
  const granted = (data.scope ?? "").split(" ");
  if (!REQUIRED_SCOPES.every((s) => granted.includes(s))) return back("permisos_incompletos");

  // 3) Email of the connected Google account (id_token received from Google over TLS).
  let googleEmail = "";
  try {
    const payload = JSON.parse(Buffer.from((data.id_token ?? "").split(".")[1] ?? "", "base64url").toString());
    googleEmail = String(payload.email ?? "");
  } catch {
    /* noop */
  }

  // 4) Encrypt and store.
  let refreshTokenEnc: string;
  try {
    refreshTokenEnc = encryptToken(data.refresh_token);
  } catch {
    return back("error", "config_llave_cifrado");
  }

  try {
    const record = { googleEmail, refreshTokenEnc, scopes: data.scope ?? "", connectedAt: new Date(), lastError: null };
    await db.googleConnection.upsert({
      where: { userId },
      create: { userId, ...record },
      update: record,
    });
  } catch (e) {
    console.error("[google] save failed:", e);
    return back("error", "guardar");
  }

  const membership = await db.membership.findFirst({ where: { userId }, select: { organizationId: true } });
  if (membership) {
    logActivity({ userId, organizationId: membership.organizationId, action: "google.connect", detail: googleEmail });
  }
  return back("ok");
}
