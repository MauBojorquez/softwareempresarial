import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import crypto from "crypto";

/**
 * API keys are org-level credentials; only Dirección (ADMIN membership) may
 * list, create or delete them. Returns the caller's ADMIN membership or a
 * NextResponse error to return as-is.
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) {
    return { error: NextResponse.json({ error: "No organization" }, { status: 404 }) };
  }
  if (membership.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Solo Dirección puede gestionar API Keys" }, { status: 403 }) };
  }
  return { userId: session.user.id, orgId: membership.organizationId };
}

export async function GET() {
  const ctx = await requireAdmin();
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
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;

  const { name } = await req.json();
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
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;

  const { id } = await req.json();
  await db.apiKey.deleteMany({
    where: { id, userId: ctx.userId },
  });

  return NextResponse.json({ ok: true });
}
