import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { logActivity } from "@/lib/activity";
import { ALL_CATEGORIES } from "@/lib/metric-templates";
import { syncSheetForOrg, type CellMapping, type SheetMeta } from "@/server/services/sheets-sync";
import { toCsvUrl } from "@/lib/google-sheets";

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
    url: meta?.url ?? "",
    mappings: meta?.mappings ?? [],
    lastSyncAt: integration.lastSyncAt,
  });
}

/** POST — connect (or update) a Google Sheet with cell mappings, then sync. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "No tienes permiso para conectar integraciones" }, { status: 403 });
  }

  const { url, mappings } = (await req.json()) as { url: string; mappings: CellMapping[] };
  if (!url || !toCsvUrl(url)) {
    return NextResponse.json({ error: "URL de Google Sheets inválida" }, { status: 400 });
  }
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un mapeo de celda" }, { status: 400 });
  }
  const clean = mappings.filter(
    (m) => Number.isInteger(m.row) && Number.isInteger(m.col) && m.name?.trim() && ALL_CATEGORIES.includes(m.category)
  ).slice(0, 200);
  if (clean.length === 0) {
    return NextResponse.json({ error: "Mapeos inválidos" }, { status: 400 });
  }

  const meta: SheetMeta = { provider: "google_sheets", url, mappings: clean };

  await db.integration.upsert({
    where: { organizationId_type: { organizationId: membership.organizationId, type: "CUSTOM_API" } },
    create: {
      organizationId: membership.organizationId,
      type: "CUSTOM_API",
      accessToken: url,
      isActive: true,
      metadata: meta as object,
    },
    update: { accessToken: url, isActive: true, metadata: meta as object },
  });

  const sync = await syncSheetForOrg(membership.organizationId);

  logActivity({
    userId: session.user.id,
    organizationId: membership.organizationId,
    action: "integration.connect",
    detail: `Google Sheets conectado (${clean.length} celdas)`,
  });

  return NextResponse.json({ connected: true, synced: sync.synced, error: sync.error });
}

/** DELETE — disconnect the Google Sheet. */
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
