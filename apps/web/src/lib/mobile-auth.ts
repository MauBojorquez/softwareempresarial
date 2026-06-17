import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/server/db";

export async function getMobileUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  try {
    const payload = jwt.verify(auth.slice(7), process.env.NEXTAUTH_SECRET!) as {
      userId: string;
    };
    const membership = await db.membership.findFirst({
      where: { userId: payload.userId },
    });
    if (!membership) return null;
    return { userId: payload.userId, organizationId: membership.organizationId };
  } catch {
    return null;
  }
}
