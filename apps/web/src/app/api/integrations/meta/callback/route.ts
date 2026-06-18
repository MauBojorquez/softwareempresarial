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

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_code", req.url));
  }

  try {
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI!)}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&code=${code}`,
      { method: "GET" }
    );

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=token_exchange", req.url));
    }

    const tokens = await tokenResponse.json();

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${tokens.access_token}`,
      { method: "GET" }
    );

    const longLivedTokens = longLivedResponse.ok ? await longLivedResponse.json() : tokens;
    const accessToken = longLivedTokens.access_token || tokens.access_token;
    const expiresIn = longLivedTokens.expires_in || tokens.expires_in || 5184000;

    // Get ad accounts
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency&access_token=${accessToken}`
    );
    const adAccountsData = adAccountsResponse.ok ? await adAccountsResponse.json() : { data: [] };

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
          type: "META_ADS",
        },
      },
      create: {
        organizationId: membership.organizationId,
        type: "META_ADS",
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        metadata: { adAccounts: adAccountsData.data || [] },
      },
      update: {
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        metadata: { adAccounts: adAccountsData.data || [] },
        isActive: true,
      },
    });

    return NextResponse.redirect(new URL("/dashboard/integrations?success=meta", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=meta_failed", req.url));
  }
}
