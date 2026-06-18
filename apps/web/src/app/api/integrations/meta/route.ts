import { NextResponse } from "next/server";
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

  const clientId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  const scope = "ads_read,ads_management,read_insights";

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}&scope=${encodeURIComponent(scope)}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
