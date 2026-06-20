import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, theme: true, avatar: true, activeOrgId: true, createdAt: true, phone: true, notifyEmail: true, notifyWhatsapp: true },
    });

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          select: { id: true, name: true, industry: true, logo: true, brandColor: true },
        },
      },
    });

    return NextResponse.json({
      user,
      organization: membership?.organization ?? null,
      allowedSections: membership?.allowedSections ?? [],
    });
  } catch {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return NextResponse.json({ user: { ...user, theme: "system" }, organization: null });
  }
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host.split(":")[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, theme, orgName, industry, currentPassword, newPassword, avatar, phone, notifyEmail, notifyWhatsapp } = body;

  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim().slice(0, 100);
  if (typeof theme === "string" && ["light", "dark", "system"].includes(theme)) updates.theme = theme;

  if (typeof phone === "string") {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (cleaned && !/^\+\d{8,16}$/.test(cleaned)) {
      return NextResponse.json({ error: "Número de teléfono inválido" }, { status: 400 });
    }
    updates.phone = cleaned || null;
  }
  if (typeof notifyEmail === "boolean") updates.notifyEmail = notifyEmail;
  if (typeof notifyWhatsapp === "boolean") updates.notifyWhatsapp = notifyWhatsapp;

  if (typeof avatar === "string") {
    if (avatar && avatar.length > 2_800_000) {
      return NextResponse.json({ error: "La foto no debe superar 2 MB" }, { status: 400 });
    }
    updates.avatar = avatar || null;
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Se requiere la contraseña actual" }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Esta cuenta usa inicio de sesión social" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updates).length > 0) {
    await db.user.update({ where: { id: session.user.id }, data: updates });
  }

  if (orgName || industry !== undefined) {
    const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
    // Only ADMINs may rename the organization or change its industry.
    if (membership && membership.role === "ADMIN") {
      const orgUpdates: Record<string, unknown> = {};
      if (typeof orgName === "string" && orgName.trim()) orgUpdates.name = orgName.trim().slice(0, 100);
      if (typeof industry === "string") orgUpdates.industry = industry.trim().slice(0, 100);
      if (Object.keys(orgUpdates).length > 0) {
        await db.organization.update({ where: { id: membership.organizationId }, data: orgUpdates });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host.split(":")[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (body.confirmation !== "ELIMINAR") {
    return NextResponse.json({ error: "Confirmación incorrecta" }, { status: 400 });
  }

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: { include: { subscription: true } } },
  });

  // Track member users (other than the owner) belonging to orgs we're about to
  // delete. After the org is gone we'll remove any of them who have no other
  // organization left — so invited teammates (e.g. Anahí) don't linger as
  // orphaned accounts.
  const memberUserIds = new Set<string>();

  try {
    for (const m of memberships) {
      const org = m.organization;
      if (org.ownerId !== session.user.id) continue; // only delete orgs the user owns

      // Collect everyone else who is a member of this org BEFORE we delete it.
      const orgMembers = await db.membership.findMany({
        where: { organizationId: org.id, userId: { not: session.user.id } },
        select: { userId: true },
      });
      for (const om of orgMembers) memberUserIds.add(om.userId);

      // Cancel the Stripe subscription if there is a real one.
      const stripeSub = org.subscription;
      if (stripeSub?.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        try {
          const { stripe } = await import("@/lib/stripe");
          await stripe.subscriptions.cancel(stripeSub.stripeSubscriptionId);
        } catch (err) {
          console.error("Failed to cancel Stripe subscription on account delete:", err);
        }
      }

      // Deleting the organization cascades all org-scoped data (metrics,
      // reports, chat, integrations, dashboards, subscription, memberships,
      // invitations, alert rules, SAT credentials, activity logs).
      await db.organization.delete({ where: { id: org.id } });
    }

    // Remove invited members who no longer belong to any organization.
    for (const memberId of memberUserIds) {
      const remaining = await db.membership.count({ where: { userId: memberId } });
      const ownsOther = await db.organization.count({ where: { ownerId: memberId } });
      if (remaining === 0 && ownsOther === 0) {
        await db.user.delete({ where: { id: memberId } }).catch((err) => {
          console.error("Failed to delete orphaned member on account delete:", memberId, err);
        });
      }
    }

    await db.user.delete({ where: { id: session.user.id } });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
