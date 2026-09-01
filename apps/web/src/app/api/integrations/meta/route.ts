import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const clientId = process.env.META_APP_ID;
  const redirectUri = `${req.nextUrl.origin}/api/integrations/meta/callback`;
  const scope = "ads_read,ads_management,business_management";
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&state=${state}`
  );
  res.cookies.set("meta_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600 });
  return res;

}
