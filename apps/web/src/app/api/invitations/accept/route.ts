import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  if (invitation.acceptedAt) return NextResponse.json({ error: "Esta invitación ya fue usada" }, { status: 409 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Esta invitación expiró" }, { status: 410 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Not logged in — return org name so the register/login page can show context
    return NextResponse.json({
      requiresAuth: true,
      email: invitation.email,
      orgName: invitation.organization.name,
    });
  }

  // Verify the logged-in user's email matches the invitation (case-insensitive).
  const sessionEmail = (session.user.email ?? "").trim().toLowerCase();
  if (!sessionEmail || sessionEmail !== invitation.email.trim().toLowerCase()) {
    return NextResponse.json({
      error: `Esta invitación es para ${invitation.email}. Inicia sesión con ese correo.`,
    }, { status: 403 });
  }

  // Add membership (carry over allowedSections + jobRole from the invitation)
  await db.membership.upsert({
    where: { userId_organizationId: { userId: session.user.id, organizationId: invitation.organizationId } },
    create: { userId: session.user.id, organizationId: invitation.organizationId, role: invitation.role, allowedSections: invitation.allowedSections, jobRole: invitation.jobRole },
    update: { role: invitation.role, allowedSections: invitation.allowedSections, jobRole: invitation.jobRole },
  });

  await db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });

  return NextResponse.json({ success: true, orgName: invitation.organization.name });
}
