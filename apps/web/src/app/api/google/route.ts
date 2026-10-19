import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { decryptToken } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

// GET /api/google — connection status of the signed-in user (never the token).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const conn = await db.googleConnection.findUnique({
    where: { userId: session.user.id },
    select: { googleEmail: true, connectedAt: true, lastUsedAt: true, lastError: true },
  });
  return NextResponse.json({ connected: !!conn, ...(conn ?? {}) });
}

// DELETE /api/google — disconnect: revoke at Google and delete the stored token.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const conn = await db.googleConnection.findUnique({ where: { userId: session.user.id } });
  if (conn) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: decryptToken(conn.refreshTokenEnc) }),
      });
    } catch {
      /* best effort: the local token is deleted regardless */
    }
    await db.googleConnection.delete({ where: { userId: session.user.id } });
  }
  return NextResponse.json({ ok: true });
}
