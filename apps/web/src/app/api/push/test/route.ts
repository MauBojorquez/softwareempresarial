import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendPushToUser } from "@/server/services/push/send-push";

export const runtime = "nodejs";

// Send a test push to the current user's devices, so they can confirm
// notifications are working end to end.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sendPushToUser(session.user.id, {
    title: "StratiuMetrics ✅",
    body: "¡Las notificaciones push funcionan correctamente en este dispositivo!",
    url: "/dashboard/overview",
    tag: "test",
  });

  return NextResponse.json({ ok: true });
}
