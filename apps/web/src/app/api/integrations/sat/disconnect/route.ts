import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";
import { deleteFacturapiOrg } from "@/server/services/sat/facturapi-service";

export async function DELETE(req: NextRequest) {
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

  const credential = await db.satCredential.findUnique({
    where: { organizationId: membership.organizationId },
  });

  if (!credential) {
    return NextResponse.json(
      { error: "No SAT credential found" },
      { status: 404 },
    );
  }

  try {
    // Remove from Facturapi first (best-effort — don't fail if already gone)
    await deleteFacturapiOrg(credential.facturapiOrgId);
  } catch (err) {
    console.error("[SAT] Facturapi deleteOrg error (continuing):", err);
  }

  // Delete from DB
  await db.satCredential.delete({
    where: { organizationId: membership.organizationId },
  });

  return NextResponse.json({ success: true });
}
