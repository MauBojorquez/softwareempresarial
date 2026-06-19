import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        select: { id: true, name: true, industry: true, logo: true, brandColor: true, ownerId: true },
      },
    },
  });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { activeOrgId: true },
  });

  const orgs = memberships.map((m) => ({
    ...m.organization,
    role: m.role,
    isOwner: m.organization.ownerId === session.user.id,
    isActive: m.organizationId === (user?.activeOrgId ?? memberships[0]?.organizationId),
  }));

  return NextResponse.json({ organizations: orgs, activeOrgId: user?.activeOrgId });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, industry } = body;
  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const org = await db.organization.create({
    data: {
      name: name.trim().slice(0, 100),
      industry: industry?.trim().slice(0, 100) || null,
      ownerId: session.user.id,
      subscription: {
        create: {
          stripeCustomerId: `cus_free_${session.user.id}_${Date.now()}`,
          plan: "FREE",
          status: "ACTIVE",
          interval: "MONTHLY",
        },
      },
    },
  });

  await db.membership.create({
    data: { userId: session.user.id, organizationId: org.id, role: "ADMIN" },
  });

  // Auto-switch to new org
  await db.user.update({
    where: { id: session.user.id },
    data: { activeOrgId: org.id },
  });

  return NextResponse.json({ organization: org });
}
