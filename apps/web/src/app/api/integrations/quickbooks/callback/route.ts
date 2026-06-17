import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_params", req.url));
  }

  try {
    const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=token_exchange", req.url));
    }

    const tokens = await tokenResponse.json();

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=no_org", req.url));
    }

    await db.integration.upsert({
      where: {
        organizationId_type: {
          organizationId: membership.organizationId,
          type: "QUICKBOOKS",
        },
      },
      create: {
        organizationId: membership.organizationId,
        type: "QUICKBOOKS",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        metadata: { realmId },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        metadata: { realmId },
        isActive: true,
      },
    });

    return NextResponse.redirect(new URL("/dashboard/integrations?success=quickbooks", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=quickbooks_failed", req.url));
  }
}
