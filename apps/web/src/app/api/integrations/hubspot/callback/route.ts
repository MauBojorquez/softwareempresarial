import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const storedState = req.cookies.get("hs_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_code", req.url));
  }

  // CSRF validation
  if (!storedState || !returnedState || returnedState !== storedState) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid_state", req.url));
  }

  try {
    const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const redirectUri = `${origin}/api/integrations/hubspot/callback`;

    const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("HubSpot token exchange failed:", tokenResponse.status, errText);
      return NextResponse.redirect(new URL("/dashboard/integrations?error=token_exchange", req.url));
    }

    const tokens = await tokenResponse.json();

    const membership = await ensureMembership(session.user.id);

    if (!membership) {
      // Session points to a user that no longer exists — force re-login.
      return NextResponse.redirect(new URL("/login?error=session_expired", req.url));
    }

    await db.integration.upsert({
      where: {
        organizationId_type: {
          organizationId: membership.organizationId,
          type: "HUBSPOT",
        },
      },
      create: {
        organizationId: membership.organizationId,
        type: "HUBSPOT",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
    });

    const successRes = NextResponse.redirect(new URL("/dashboard/integrations?success=hubspot", req.url));
    successRes.cookies.delete("hs_oauth_state");
    return successRes;
  } catch {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=hubspot_failed", req.url));
  }
}
