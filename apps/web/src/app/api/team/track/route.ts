import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { logActivity } from "@/lib/activity";
import { getOrganizationId } from "@/lib/get-org";

// POST /api/team/track — records a page view for usage analytics.
// Deduped: at most one "page.view" per user+path every 10 minutes so the
// table doesn't balloon from client-side navigation.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  let path = "";
  try {
    const body = await req.json();
    path = typeof body?.path === "string" ? body.path.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!path.startsWith("/dashboard")) return NextResponse.json({ ok: true });

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recent = await db.activityLog.findFirst({
    where: { userId: session.user.id, action: "page.view", path, createdAt: { gte: tenMinAgo } },
  });
  if (recent) return NextResponse.json({ ok: true, deduped: true });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ ok: false }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    organizationId: orgId,
    action: "page.view",
    path,
  });
  return NextResponse.json({ ok: true });
}
