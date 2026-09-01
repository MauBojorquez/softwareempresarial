import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  // Derive redirect URI from request origin so it works on any environment (localhost, Vercel preview, production)
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const redirectUri = `${origin}/api/integrations/hubspot/callback`;

  const scope = "crm.objects.contacts.read crm.objects.deals.read oauth";

  // CSRF protection: generate a random state tied to the user's session
  const state = Buffer.from(JSON.stringify({ userId: session.user.id, nonce: Math.random().toString(36).slice(2) })).toString("base64url");

  const authUrl =
    `https://app.hubspot.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  const res = NextResponse.redirect(authUrl);
  // Store state in a short-lived cookie for callback validation
  res.cookies.set("hs_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 300, path: "/" });
  return res;
}

