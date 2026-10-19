import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GOOGLE_SCOPES, googleClient } from "@/server/services/google/oauth";

export const dynamic = "force-dynamic";

// GET /api/google/connect — starts the per-user Google consent (Gmail + Drive,
// read-only). Each collaborator connects only their own account.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login`);
  }

  let client;
  try {
    client = googleClient();
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings?google=no_configurado`);
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    ...(session.user.email ? { login_hint: session.user.email } : {}),
  }).toString();

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
