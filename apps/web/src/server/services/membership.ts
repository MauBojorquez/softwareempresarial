import { db } from "@/server/db";
import type { Membership } from "@prisma/client";

/**
 * Returns the user's membership, creating an organization + membership on the
 * fly if one is missing. Used by OAuth callbacks so a connection never bounces
 * with "no organization" just because the membership wasn't set up.
 *
 * Returns null only when the user id itself doesn't exist in the DB (e.g. a
 * stale JWT pointing to a deleted account) — callers should treat that as
 * "force re-login".
 */
export async function ensureMembership(userId: string): Promise<Membership | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const existing = await db.membership.findFirst({ where: { userId } });
  if (existing) return existing;

  // The user may already own an org whose membership got removed — reuse it.
  let org = await db.organization.findFirst({ where: { ownerId: userId } });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: user.name ?? user.email ?? "Mi Empresa",
        ownerId: userId,
        subscription: {
          create: {
            stripeCustomerId: `cus_free_${userId}`,
            plan: "FREE",
            status: "ACTIVE",
            interval: "MONTHLY",
          },
        },
      },
    });
  }

  return db.membership.create({
    data: { userId, organizationId: org.id, role: "ADMIN" },
  });
}
