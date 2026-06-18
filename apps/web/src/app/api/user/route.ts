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
      select: { id: true, name: true, email: true, theme: true, createdAt: true },
    });

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { id: true, name: true, industry: true } } },
    });

    return NextResponse.json({ user, organization: membership?.organization ?? null });
  } catch {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { id: true, name: true, industry: true } } },
    });

    return NextResponse.json({ user: { ...user, theme: "system" }, organization: membership?.organization ?? null });
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
  const { name, theme, orgName, industry, currentPassword, newPassword } = body;

  const updates: Record<string, any> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim().slice(0, 100);
  if (typeof theme === "string" && ["light", "dark", "system"].includes(theme)) updates.theme = theme;

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

  if (orgName || industry) {
    const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
    if (membership) {
      const orgUpdates: Record<string, any> = {};
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

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (membership) {
    await db.metric.deleteMany({ where: { organizationId: membership.organizationId } });
    await db.aIReport.deleteMany({ where: { organizationId: membership.organizationId } });
    await db.integration.deleteMany({ where: { organizationId: membership.organizationId } });
    await db.dashboard.deleteMany({ where: { organizationId: membership.organizationId } });
    await db.subscription.deleteMany({ where: { organizationId: membership.organizationId } });
    await db.membership.deleteMany({ where: { organizationId: membership.organizationId } });
    await db.organization.delete({ where: { id: membership.organizationId } });
  }

  await db.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
