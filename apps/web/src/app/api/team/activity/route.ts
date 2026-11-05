import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

// GET /api/team/activity — team usage analytics for the active org.
// Returns members (with last-seen + 30-day activity counts) and a recent
// activity feed. The full feed (which can include money amounts in `detail`)
// is restricted to Dirección (jobRole DIRECCION or ADMIN membership); any other
// member only gets their own entries.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const caller = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    select: { role: true, jobRole: true },
  });
  if (!caller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const seesAll = caller.role === "ADMIN" || caller.jobRole === "DIRECCION";
  // Non-Dirección callers are scoped to their own rows everywhere.
  const userScope = seesAll ? {} : { userId: session.user.id };

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [memberships, logs, eventCount, activeUserRows] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: orgId, ...userScope },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, createdAt: true } } },
    }),
    db.activityLog.findMany({
      where: { organizationId: orgId, ...userScope },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    }),
    db.activityLog.count({ where: { organizationId: orgId, ...userScope, createdAt: { gte: since } } }),
    db.activityLog.groupBy({
      by: ["userId"],
      where: { organizationId: orgId, ...userScope, createdAt: { gte: since } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  const statsByUser = new Map(
    activeUserRows.map((r) => [r.userId, { count: r._count._all, lastSeen: r._max.createdAt }]),
  );

  const members = memberships.map((m) => {
    const stats = statsByUser.get(m.userId);
    return {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.user.createdAt,
      lastSeen: stats?.lastSeen ?? null,
      events30d: stats?.count ?? 0,
    };
  });

  const activity = logs.map((l) => ({
    id: l.id,
    action: l.action,
    detail: l.detail,
    path: l.path,
    createdAt: l.createdAt,
    user: { id: l.user.id, name: l.user.name, email: l.user.email, avatar: l.user.avatar },
  }));

  const activeMembers = members.filter((m) => m.events30d > 0).length;

  return NextResponse.json({
    members,
    activity,
    stats: { totalMembers: members.length, activeMembers, events30d: eventCount },
  });
}
