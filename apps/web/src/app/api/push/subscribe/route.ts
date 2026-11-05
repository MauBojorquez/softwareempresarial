import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";

// Register (or refresh) a Web Push subscription for the current user/device.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

  try {
    if (
      typeof endpoint !== "string" || !endpoint ||
      typeof keys?.p256dh !== "string" || !keys.p256dh ||
      typeof keys?.auth !== "string" || !keys.auth
    ) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        userId: session.user.id,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la suscripción" }, { status: 500 });
  }
}

// Remove a subscription (when the user disables push on this device).
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";

  try {
    if (endpoint) {
      await db.pushSubscription.deleteMany({
        where: { endpoint, userId: session.user.id },
      });
    }
  } catch (err) {
    console.error("push unsubscribe failed:", err);
    return NextResponse.json({ error: "No se pudo eliminar la suscripción" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
