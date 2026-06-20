import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

/**
 * GET /api/invitations/preview?token=xxx
 * Returns email + orgName for an invitation without any side effects.
 * Used by /invite/[token]/setup to pre-fill the form.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (!invitation) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  if (invitation.acceptedAt) return NextResponse.json({ error: "Esta invitación ya fue usada" }, { status: 409 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Esta invitación expiró" }, { status: 410 });

  return NextResponse.json({
    email: invitation.email,
    orgName: invitation.organization.name,
  });
}
