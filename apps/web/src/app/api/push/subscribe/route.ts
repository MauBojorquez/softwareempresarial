import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";

// Register (or refresh) a Web Push subscription for the current user/device.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { endpoint } = await req.json();
    if (endpoint) {
      await db.pushSubscription.deleteMany({
        where: { endpoint, userId: session.user.id },
      });
    }
  } catch {}

  return NextResponse.json({ ok: true });
}
