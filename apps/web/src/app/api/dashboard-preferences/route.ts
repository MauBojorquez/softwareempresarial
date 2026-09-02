import { NextRequest, NextResponse } from "next/server";
import { resolveMember } from "@/lib/access";
import { db } from "@/server/db";
import { availableBlocks, defaultsFor } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// GET /api/dashboard-preferences — the caller's chosen blocks (or null if never
// chosen → UI shows onboarding), plus the blocks available to their role and the
// role defaults. Any authenticated member may call this.
export async function GET(req: NextRequest) {
  const access = await resolveMember(req);
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const pref = await db.dashboardPreference.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });

  const available = availableBlocks(jobRole).map((b) => ({ id: b.id, label: b.label }));
  const allowedIds = new Set(available.map((b) => b.id));

  // Stored bloques could contain an id that is no longer allowed (role changed) —
  // strip those so the UI never renders a forbidden block.
  const stored = Array.isArray(pref?.bloques)
    ? (pref!.bloques as unknown[]).filter(
        (id): id is string => typeof id === "string" && allowedIds.has(id),
      )
    : null;

  return NextResponse.json({
    bloques: stored,
    available,
    defaults: defaultsFor(jobRole),
  });
}

// PUT /api/dashboard-preferences — save the caller's block selection. Any id not
// in availableBlocks(jobRole) is stripped (never stored). Upsert on (userId, org).
export async function PUT(req: NextRequest) {
  const access = await resolveMember(req);
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.bloques) ? body.bloques : [];

  const allowedIds = new Set(availableBlocks(jobRole).map((b) => b.id));
  const seen = new Set<string>();
  const bloques: string[] = [];
  for (const id of raw) {
    if (typeof id === "string" && allowedIds.has(id) && !seen.has(id)) {
      seen.add(id);
      bloques.push(id);
    }
  }

  await db.dashboardPreference.upsert({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    create: { userId, organizationId: orgId, bloques },
    update: { bloques },
  });

  return NextResponse.json({ bloques });
}
