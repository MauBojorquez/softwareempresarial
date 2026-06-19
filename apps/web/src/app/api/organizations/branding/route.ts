import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: orgId, role: { in: ["ADMIN"] } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, string | null> = {};

  if (typeof body.brandColor === "string") {
    const color = body.brandColor.trim();
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "Color inválido. Usa formato #RRGGBB" }, { status: 400 });
    }
    updates.brandColor = color || null;
  }

  if (typeof body.logo === "string") {
    // Accept base64 data URL (data:image/...) up to ~2MB
    if (body.logo && body.logo.length > 2_800_000) {
      return NextResponse.json({ error: "El logo no debe superar 2 MB" }, { status: 400 });
    }
    updates.logo = body.logo || null;
  }

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim().slice(0, 100);
  }

  await db.organization.update({ where: { id: orgId }, data: updates });

  return NextResponse.json({ ok: true });
}
