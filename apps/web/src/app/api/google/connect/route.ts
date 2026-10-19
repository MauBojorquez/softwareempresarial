import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GOOGLE_SCOPES, googleClient } from "@/server/services/google/oauth";
import { signState } from "@/lib/token-crypto";

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

  const state = signState(session.user.id);
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

  return NextResponse.redirect(url.toString());
}
