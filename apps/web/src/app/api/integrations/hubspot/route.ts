import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { checkFeatureAccess } from "@/server/services/billing/plan-limits";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect("/login");
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (membership) {
    const access = await checkFeatureAccess(membership.organizationId, "integrations");
    if (!access.allowed) {
      return NextResponse.redirect(`/dashboard/billing?error=limit&message=${encodeURIComponent(access.reason!)}`);
    }
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  const scope = "crm.objects.deals.read crm.objects.contacts.read";

  const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(authUrl);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();

  const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
      code,
    }),
  });

  const tokens = await tokenResponse.json();

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 404 });
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

  return NextResponse.json({ success: true });
}
