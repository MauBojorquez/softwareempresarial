import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import crypto from "crypto";
import { getOrganizationId } from "@/lib/get-org";

/**
 * API keys are org-level credentials; only Dirección (ADMIN membership) may
 * list, create or delete them. Returns the caller's ADMIN membership or a
 * NextResponse error to return as-is.
 */
async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  // Membership for the ACTIVE org (respects activeOrgId).
  const orgId = await getOrganizationId(req);
  const membership = orgId
    ? await db.membership.findFirst({ where: { userId: session.user.id, organizationId: orgId } })
    : null;
  if (!membership) {
    return { error: NextResponse.json({ error: "Organización no encontrada" }, { status: 404 }) };
  }
  if (membership.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Solo Dirección puede gestionar API Keys" }, { status: 403 }) };
  }
  return { userId: session.user.id, orgId: membership.organizationId };
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;

  try {
    const keys = await db.apiKey.findMany({
      where: { userId: ctx.userId },
      select: { id: true, name: true, key: true, lastUsed: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const masked = keys.map((k) => ({
      ...k,
      key: k.key.slice(0, 8) + "..." + k.key.slice(-4),
    }));

    return NextResponse.json({ keys: masked });
  } catch {
    return NextResponse.json({ keys: [] });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const key = `mp_${crypto.randomBytes(24).toString("hex")}`;

  const apiKey = await db.apiKey.create({
    data: {
      name: (name || "API Key").slice(0, 50),
      key,
      userId: ctx.userId,
      organizationId: ctx.orgId,
    },
  });

  return NextResponse.json({ id: apiKey.id, key, name: apiKey.name });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await db.apiKey.deleteMany({
    where: { id, userId: ctx.userId },
  });

  return NextResponse.json({ ok: true });
}
