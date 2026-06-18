import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { checkFeatureAccess } from "@/server/services/billing/plan-limits";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (membership) {
    const access = await checkFeatureAccess(membership.organizationId, "integrations");
    if (!access.allowed) {
      return NextResponse.redirect(
        new URL(`/dashboard/billing?error=limit&message=${encodeURIComponent(access.reason!)}`, req.url)
      );
    }
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  // Derive redirect URI from request origin so it works on any environment (localhost, Vercel preview, production)
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const redirectUri = `${origin}/api/integrations/hubspot/callback`;

  const scope = "crm.objects.contacts.read crm.objects.deals.read oauth";

  const authUrl =
    `https://app.hubspot.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;

  return NextResponse.redirect(authUrl);
}

