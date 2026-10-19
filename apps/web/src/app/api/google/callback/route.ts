import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { encryptToken } from "@/lib/token-crypto";
import { REQUIRED_SCOPES, googleClient } from "@/server/services/google/oauth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

function back(status: string) {
  const res = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings?google=${status}`);
  res.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
  return res;
}

// GET /api/google/callback — Google redirects here after consent. Stores the
// refresh token encrypted for the signed-in user.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login`);

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back("cancelado");

  const state = sp.get("state");
  if (!state || state !== req.cookies.get("g_oauth_state")?.value) return back("error");

  const code = sp.get("code");
  if (!code) return back("error");

  try {
    const { clientId, clientSecret, redirectUri } = googleClient();
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = (await res.json()) as {
      refresh_token?: string;
      scope?: string;
      id_token?: string;
      error?: string;
    };
    if (!res.ok || !data.refresh_token) {
      console.error("[google] code exchange failed:", data.error ?? res.status);
      return back("error");
    }

    // Every read-only scope must be granted (the user may untick boxes).
    const granted = (data.scope ?? "").split(" ");
    if (!REQUIRED_SCOPES.every((s) => granted.includes(s))) return back("permisos_incompletos");

    // Email of the connected Google account, from the id_token we just received
    // directly from Google over TLS.
    let googleEmail = "";
    try {
      const payload = JSON.parse(Buffer.from((data.id_token ?? "").split(".")[1] ?? "", "base64url").toString());
      googleEmail = String(payload.email ?? "");
    } catch {
      /* noop */
    }

    const record = {
      googleEmail,
      refreshTokenEnc: encryptToken(data.refresh_token),
      scopes: data.scope ?? "",
      connectedAt: new Date(),
      lastError: null,
    };
    await db.googleConnection.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...record },
      update: record,
    });

    const membership = await db.membership.findFirst({ where: { userId: session.user.id }, select: { organizationId: true } });
    if (membership) {
      logActivity({ userId: session.user.id, organizationId: membership.organizationId, action: "google.connect", detail: googleEmail });
    }
    return back("ok");
  } catch (e) {
    console.error("[google] callback error:", e);
    return back("error");
  }
}
