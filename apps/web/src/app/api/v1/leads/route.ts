import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * Resolves the default owner (dueño) for an ingested Meta lead, in priority order:
 *  1. explicit `duenoEmail` in the request body (configurable from Make),
 *  2. the env var META_LEAD_OWNER_EMAIL (matched to an org member),
 *  3. the org's COMERCIAL member (assign the puesto to configure it),
 *  4. the organization owner as a last resort.
 * Nothing is hardcoded to a specific person.
 */
async function resolveOwner(orgId: string, duenoEmail?: string | null): Promise<string | null> {
  const byEmail = async (email?: string | null) => {
    if (!email) return null;
    const m = await db.membership.findFirst({
      where: { organizationId: orgId, user: { email: email.trim().toLowerCase() } },
      select: { userId: true },
    });
    return m?.userId ?? null;
  };

  return (
    (await byEmail(duenoEmail)) ||
    (await byEmail(process.env.META_LEAD_OWNER_EMAIL)) ||
    (await db.membership
      .findFirst({ where: { organizationId: orgId, jobRole: "COMERCIAL" }, select: { userId: true } })
      .then((m) => m?.userId ?? null)) ||
    (await db.organization
      .findUnique({ where: { id: orgId }, select: { ownerId: true } })
      .then((o) => o?.ownerId ?? null))
  );
}

// POST /api/v1/leads — ingest a lead from Meta Ads via Make.
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-leads", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "El cuerpo debe ser un JSON válido." }, { status: 400 });
  }

  const nombre = (body.nombre ?? "").toString().trim();
  if (!nombre) {
    return NextResponse.json({ error: "El campo 'nombre' es obligatorio." }, { status: 400 });
  }

  const empresa = body.empresa ? String(body.empresa).trim() : null;
  const contacto = body.contacto ? String(body.contacto).trim() : null;
  const campana = (body.campana ?? body.campaña ?? body.campaign);
  const campanaStr = campana ? String(campana).trim() : null;

  const duenoId = await resolveOwner(organizationId, body.duenoEmail);
  if (!duenoId) {
    return NextResponse.json(
      { error: "No hay un dueño disponible para asignar el lead. Configura META_LEAD_OWNER_EMAIL o asigna el puesto Comercial a un miembro." },
      { status: 422 },
    );
  }

  const lead = await db.lead.create({
    data: {
      nombre,
      empresa,
      contacto,
      campana: campanaStr,
      origen: "META",
      etapa: "NUEVO",
      duenoId,
      organizationId,
      fechaUltimoMovimiento: new Date(),
    },
  });

  logActivity({
    userId: duenoId,
    organizationId,
    action: "lead.ingest.meta",
    detail: campanaStr ? `${nombre} · ${campanaStr}` : nombre,
  });

  return NextResponse.json(
    { ok: true, leadId: lead.id, etapa: lead.etapa, origen: lead.origen, duenoId },
    { status: 201 },
  );
}
