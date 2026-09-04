import { NextRequest, NextResponse } from "next/server";
import type { LeadOrigen, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseEmail, parsePhone } from "@/lib/lead-contact";

export const dynamic = "force-dynamic";

const ORIGENES = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"] as const;
const MAX_ROWS = 2000;

type RawRow = {
  nombre?: unknown;
  empresa?: unknown;
  contacto?: unknown;
  telefono?: unknown;
  email?: unknown;
  origen?: unknown;
  valorEstimado?: unknown;
  valorMensualEstimado?: unknown;
  duenoId?: unknown;
};

function toNumberOrNull(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  // Tolerate values like "$1,200.50" coming from a spreadsheet export.
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// POST /api/leads/import — bulk-create leads from a mapped CSV.
// Body: { rows: RawRow[], defaultOrigen?, defaultDuenoId? }
// Each row already carries lead fields (the client did the column mapping);
// this validates, fills defaults, and inserts the valid ones. Gated by "crm".
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, userId } = access;

  const body = await req.json().catch(() => ({}));
  const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Demasiadas filas (máximo ${MAX_ROWS} por importación)` },
      { status: 400 },
    );
  }

  const defaultOrigen = ORIGENES.includes(body?.defaultOrigen)
    ? (body.defaultOrigen as LeadOrigen)
    : null;

  // Resolve valid owners once. Any duenoId not in the org falls back to caller.
  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((m) => m.userId));

  let defaultDuenoId = userId;
  if (body?.defaultDuenoId && memberIds.has(String(body.defaultDuenoId))) {
    defaultDuenoId = String(body.defaultDuenoId);
  }

  const toCreate: Prisma.LeadCreateManyInput[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const warnings: { row: number; reason: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 1;
    const nombre = String(r.nombre ?? "").trim();
    if (!nombre) {
      skipped.push({ row: rowNum, reason: "Sin nombre" });
      return;
    }

    // Origen: the row value wins, else the import default. Required.
    const rawOrigen = String(r.origen ?? "").trim().toUpperCase().replace(/\s+/g, "_");
    let origen: LeadOrigen | null = ORIGENES.includes(rawOrigen as LeadOrigen)
      ? (rawOrigen as LeadOrigen)
      : null;
    if (!origen) origen = defaultOrigen;
    if (!origen) {
      skipped.push({ row: rowNum, reason: "Sin origen válido" });
      return;
    }

    // Invalid contact fields never drop a lead — they're nulled with a warning.
    const emailResult = parseEmail(r.email);
    let email: string | null = null;
    if (emailResult.ok) email = emailResult.value;
    else warnings.push({ row: rowNum, reason: "Correo inválido (se omitió)" });

    const telResult = parsePhone(r.telefono);
    let telefono: string | null = null;
    if (telResult.ok) telefono = telResult.value;
    else warnings.push({ row: rowNum, reason: "Teléfono inválido (se omitió)" });

    let duenoId = defaultDuenoId;
    if (r.duenoId && memberIds.has(String(r.duenoId))) duenoId = String(r.duenoId);

    toCreate.push({
      organizationId: orgId,
      nombre,
      empresa: r.empresa ? String(r.empresa).trim() || null : null,
      contacto: r.contacto ? String(r.contacto).trim() || null : null,
      telefono,
      email,
      origen,
      valorEstimado: toNumberOrNull(r.valorEstimado),
      valorMensualEstimado: toNumberOrNull(r.valorMensualEstimado),
      duenoId,
    });
  });

  let imported = 0;
  if (toCreate.length > 0) {
    const result = await db.lead.createMany({ data: toCreate });
    imported = result.count;
    logActivity({
      userId,
      organizationId: orgId,
      action: "lead.import",
      detail: `${imported} leads importados`,
    });
  }

  return NextResponse.json({
    imported,
    skipped,
    warnings,
    total: rows.length,
  });
}
