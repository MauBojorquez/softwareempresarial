import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = (await req.json()) as { type: string };

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  await db.integration.updateMany({
    where: {
      organizationId: membership.organizationId,
      type: type as any,
    },
    data: { isActive: false, accessToken: "", refreshToken: null },
  });

  return NextResponse.json({ success: true });
}
