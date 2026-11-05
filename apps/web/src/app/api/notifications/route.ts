import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { action, id } = body as { action?: unknown; id?: unknown };

  try {
    if (action === "read_all") {
      await db.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
    } else if (action === "read" && typeof id === "string" && id) {
      await db.notification.updateMany({
        where: { id, userId: session.user.id },
        data: { read: true },
      });
    }
  } catch (err) {
    console.error("notifications PATCH failed:", err);
    return NextResponse.json({ error: "No se pudieron actualizar las notificaciones" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await db.notification.deleteMany({
      where: { userId: session.user.id },
    });
  } catch (err) {
    console.error("notifications DELETE failed:", err);
    return NextResponse.json({ error: "No se pudieron eliminar las notificaciones" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
