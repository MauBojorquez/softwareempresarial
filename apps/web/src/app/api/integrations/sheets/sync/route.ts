import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { syncSheetForOrg } from "@/server/services/sheets-sync";

/** POST /api/integrations/sheets/sync — re-read the connected sheet (live refresh). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const result = await syncSheetForOrg(membership.organizationId);
  if (result.error && result.synced === 0) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ synced: result.synced });
}
