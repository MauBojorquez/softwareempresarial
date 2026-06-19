import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureMembership } from "@/server/services/membership";
import { syncSatMetrics } from "@/server/services/sat/sync-sat-metrics";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await ensureMembership(session.user.id);
  if (!membership) {
    return NextResponse.redirect(
      new URL("/login?error=session_expired", req.url),
    );
  }

  try {
    await syncSatMetrics(membership.organizationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SAT] Manual sync error:", err);
    const message =
      err instanceof Error ? err.message : "Error al sincronizar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
