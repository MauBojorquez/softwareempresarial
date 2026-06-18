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

  const clientId = process.env.META_APP_ID;
  const redirectUri = `${req.nextUrl.origin}/api/integrations/meta/callback`;
  const scope = "ads_read,ads_management,business_management";

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
