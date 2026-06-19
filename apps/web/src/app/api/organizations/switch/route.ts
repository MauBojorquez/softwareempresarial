import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await req.json();
  if (!orgId) return NextResponse.json({ error: "orgId requerido" }, { status: 400 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  });
  if (!membership) return NextResponse.json({ error: "No tienes acceso a esa organización" }, { status: 403 });

  await db.user.update({
    where: { id: session.user.id },
    data: { activeOrgId: orgId },
  });

  return NextResponse.json({ ok: true });
}
