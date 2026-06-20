import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { logActivity } from "@/lib/activity";
import { ALL_CATEGORIES } from "@/lib/metric-templates";
import { upsertSheetMetrics, type CellMapping, type SheetMeta } from "@/server/services/sheets-sync";

async function getMembership(userId: string) {
  return db.membership.findFirst({ where: { userId } });
}

/** GET — current Google Sheets connection + mappings + last sync. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const integration = await db.integration.findFirst({
    where: { organizationId: membership.organizationId, type: "CUSTOM_API" },
  });
  if (!integration) return NextResponse.json({ connected: false });

  const meta = integration.metadata as unknown as SheetMeta | null;
  return NextResponse.json({
    connected: integration.isActive,
    mappings: meta?.mappings ?? [],
    lastSyncAt: integration.lastSyncAt,
  });
}

/** POST — import mapped cell values from a manually uploaded CSV. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "No tienes permiso para conectar integraciones" }, { status: 403 });
  }

  const { mappings } = (await req.json()) as { mappings: CellMapping[] };
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un mapeo de celda" }, { status: 400 });
  }
  const clean = mappings.filter(
    (m) =>
      Number.isInteger(m.row) && Number.isInteger(m.col) && m.name?.trim() &&
      ALL_CATEGORIES.includes(m.category) && typeof m.value === "number" && Number.isFinite(m.value)
  ).slice(0, 200);
  if (clean.length === 0) {
    return NextResponse.json({ error: "Mapeos inválidos o sin números válidos" }, { status: 400 });
  }

  const meta: SheetMeta = { provider: "spreadsheet_csv", mappings: clean };

  const { synced } = await upsertSheetMetrics(membership.organizationId, clean);

  await db.integration.upsert({
    where: { organizationId_type: { organizationId: membership.organizationId, type: "CUSTOM_API" } },
    create: {
      organizationId: membership.organizationId,
      type: "CUSTOM_API",
      accessToken: "spreadsheet_csv",
      isActive: true,
      metadata: meta as object,
      lastSyncAt: new Date(),
    },
    update: { isActive: true, metadata: meta as object, lastSyncAt: new Date() },
  });

  logActivity({
    userId: session.user.id,
    organizationId: membership.organizationId,
    action: "integration.connect",
    detail: `Hoja de cálculo importada (${clean.length} celdas)`,
  });

  return NextResponse.json({ connected: true, synced });
}

/** DELETE — disconnect the spreadsheet import. */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  await db.integration.deleteMany({
    where: { organizationId: membership.organizationId, type: "CUSTOM_API" },
  });

  logActivity({
    userId: session.user.id,
    organizationId: membership.organizationId,
    action: "integration.disconnect",
    detail: "Google Sheets desconectado",
  });

  return NextResponse.json({ ok: true });
}
