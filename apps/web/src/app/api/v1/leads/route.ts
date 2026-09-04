import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/server/services/push/notify";

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

  // Optional qualifying fields from the Meta lead form.
  const participantes = body.participantes ? String(body.participantes).trim() : null;
  const puesto = body.puesto ? String(body.puesto).trim() : null;
  const urgencia = body.urgencia ? String(body.urgencia).trim() : null;

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
      participantes,
      puesto,
      urgencia,
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

  // Best-effort push: alert Dirección + Comercial about the new lead so it can
  // be worked within the minute. Never blocks the ingest response.
  try {
    const recipients = await db.membership.findMany({
      where: { organizationId, jobRole: { in: ["DIRECCION", "COMERCIAL"] } },
      select: { userId: true },
    });
    const detalles = [
      empresa && `Empresa: ${empresa}`,
      participantes && `Participantes: ${participantes}`,
      puesto && `Puesto: ${puesto}`,
      urgencia && `Urgencia: ${urgencia}`,
    ].filter(Boolean);
    const message = detalles.length > 0 ? detalles.join(" · ") : "Nuevo lead de Meta";
    const seen = new Set<string>();
    await Promise.all(
      recipients
        .filter((r) => !seen.has(r.userId) && seen.add(r.userId))
        .map((r) =>
          notify({
            userId: r.userId,
            title: `Nuevo lead: ${nombre}`,
            message,
            type: "lead",
            url: "/dashboard/crm",
          }),
        ),
    );
  } catch (e) {
    console.error("meta lead push notify failed:", e);
  }

  return NextResponse.json(
    { ok: true, leadId: lead.id, etapa: lead.etapa, origen: lead.origen, duenoId },
    { status: 201 },
  );
}
