import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import crypto from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await db.apiKey.findMany({
      where: { userId: session.user.id },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 404 });
  }

  const { name } = await req.json();
  const key = `mp_${crypto.randomBytes(24).toString("hex")}`;

  const apiKey = await db.apiKey.create({
    data: {
      name: (name || "API Key").slice(0, 50),
      key,
      userId: session.user.id,
      organizationId: membership.organizationId,
    },
  });

  return NextResponse.json({ id: apiKey.id, key, name: apiKey.name });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  await db.apiKey.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
