import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { sendEmail, inviteEmail } from "@/server/services/email";
import type { MembershipRole } from "@prisma/client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

// GET /api/invitations — list pending invitations for the org
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 404 });

  const invitations = await db.invitation.findMany({
    where: { organizationId: membership.organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    include: { invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}

// POST /api/invitations — send an invitation
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`invite:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intenta más tarde." }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role = "VIEWER" } = (await req.json()) as { email: string; role?: MembershipRole };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  });
  if (!membership || membership.role === "VIEWER") {
    return NextResponse.json({ error: "No tienes permisos para invitar" }, { status: 403 });
  }

  // Prevent privilege escalation: only an ADMIN may grant ADMIN.
  if (role === "ADMIN" && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede invitar a otro administrador" }, { status: 403 });
  }

  // Check if already a member
  const alreadyMember = await db.user.findUnique({ where: { email } });
  if (alreadyMember) {
    const alreadyIn = await db.membership.findFirst({
      where: { userId: alreadyMember.id, organizationId: membership.organizationId },
    });
    if (alreadyIn) return NextResponse.json({ error: "Este usuario ya es miembro" }, { status: 409 });
  }

  // Check plan user limit
  const { PLAN_LIMITS } = await import("@/server/services/billing/plan-limits");
  const sub = await db.subscription.findUnique({ where: { organizationId: membership.organizationId } });
  const plan = sub?.plan ?? "STARTER";
  const limits = PLAN_LIMITS[plan];
  const currentMembers = await db.membership.count({ where: { organizationId: membership.organizationId } });
  const pendingInvites = await db.invitation.count({
    where: { organizationId: membership.organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (currentMembers + pendingInvites >= limits.users) {
    return NextResponse.json({ error: `Tu plan ${plan} permite máximo ${limits.users} usuarios` }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await db.invitation.upsert({
    where: { organizationId_email: { organizationId: membership.organizationId, email } },
    create: {
      email,
      role: role as MembershipRole,
      expiresAt,
      organizationId: membership.organizationId,
      invitedById: session.user.id,
    },
    update: { role: role as MembershipRole, expiresAt, acceptedAt: null, invitedById: session.user.id },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${invitation.token}`;
  const { subject, html } = inviteEmail(
    session.user.name ?? "Un compañero",
    membership.organization.name,
    inviteUrl
  );
  await sendEmail(email, subject, html);

  logActivity({
    userId: session.user.id,
    organizationId: membership.organizationId,
    action: "invite.send",
    detail: email,
  });

  return NextResponse.json({ success: true, invitation });
}

// DELETE /api/invitations?id=xxx — revoke
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  await db.invitation.deleteMany({ where: { id, organizationId: membership.organizationId } });
  return NextResponse.json({ success: true });
}
