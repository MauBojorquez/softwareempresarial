import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/server/db";

export async function getOrganizationId(req: NextRequest): Promise<string | null> {
  const mobile = await getMobileUser(req);
  if (mobile) return mobile.organizationId;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  return membership?.organizationId ?? null;
}
