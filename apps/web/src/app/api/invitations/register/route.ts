import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/invitations/register
 * Creates a new user account (no org) and immediately accepts the invitation.
 * Used by the /invite/[token]/setup page so invited team members don't need
 * to fill in a company name or create their own organization.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`invite-register:${ip}`, 10, 60_000);
  if (!rl.success) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const { token, name, password } = (await req.json()) as {
    token: string;
    name: string;
    password: string;
  };

  if (!token || !name?.trim() || !password) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  // Validate invitation
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!invitation) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  if (invitation.acceptedAt) return NextResponse.json({ error: "Esta invitación ya fue usada" }, { status: 409 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Esta invitación expiró" }, { status: 410 });

  // Check if account already exists — should not happen on this path but handle gracefully
  const existing = await db.user.findUnique({ where: { email: invitation.email } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con este correo. Inicia sesión en su lugar." }, { status: 409 });
  }

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(password, 12);

  // Create user WITHOUT org (they're joining an existing one)
  const user = await db.user.create({
    data: {
      name: name.trim().slice(0, 100),
      email: invitation.email,
      passwordHash,
    },
  });

  // Accept the invitation — create membership with section permissions
  await db.membership.create({
    data: {
      userId: user.id,
      organizationId: invitation.organizationId,
      role: invitation.role,
      allowedSections: invitation.allowedSections,
    },
  });

  await db.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    email: user.email,
    orgName: invitation.organization.name,
  });
}
