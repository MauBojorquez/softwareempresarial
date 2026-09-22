import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

// GET /api/v1/team — list the organization's members (name, email, whatsapp).
// Same API-key auth. `whatsapp` is the person's phone (E.164) from their profile.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-team", limit: 240, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const members = await db.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const team = members.map((m) => ({
    id: m.userId,
    nombre: m.user.name,
    correo: m.user.email,
    whatsapp: m.user.phone,
    puesto: m.jobRole,
  }));

  return NextResponse.json({ count: team.length, team });
}
