import { NextRequest, NextResponse } from "next/server";
import type { LeadEtapa } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const ETAPAS = [
  "NUEVO",
  "CONTACTADO",
  "SESION_AGENDADA",
  "DIAGNOSTICO_VENDIDO",
  "PROPUESTA_ENVIADA",
  "CERRADO_GANADO",
  "CERRADO_PERDIDO",
] as const;

// The WhatsApp bot is only allowed to advance a lead through the early stages.
// Everything past SESION_AGENDADA (diagnóstico, propuesta, cierre) is handled by
// a person in the app. Map: current stage → the single stage the bot may set.
const BOT_TRANSITIONS: Partial<Record<LeadEtapa, LeadEtapa>> = {
  NUEVO: "CONTACTADO",
  CONTACTADO: "SESION_AGENDADA",
};

const BOT_NOTE_PREFIX = "🤖 Bot WhatsApp: ";

// PATCH /api/v1/leads/{id} — move a lead's stage from Make (WhatsApp bot).
// Same API-key auth. Accepts: etapa, motivoPerdida (only if CERRADO_PERDIDO,
// which the bot cannot reach), nota (optional, stored as a Bot WhatsApp note).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req, { bucket: "api-leads-write", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const lead = await db.lead.findFirst({ where: { id: params.id, organizationId } });
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const rawEtapa = String(body.etapa ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!ETAPAS.includes(rawEtapa as LeadEtapa)) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }
  const etapa = rawEtapa as LeadEtapa;

  const nota = body.nota ? String(body.nota).trim() : null;

  // Idempotent: already in the requested stage → just (optionally) add the note.
  if (etapa === lead.etapa) {
    if (nota) {
      await db.leadNota.create({
        data: { leadId: lead.id, contenido: (BOT_NOTE_PREFIX + nota).slice(0, 2000) },
      });
    }
    return NextResponse.json({ ok: true, leadId: lead.id, etapa: lead.etapa, changed: false });
  }

  // Enforce the bot's state machine: only NUEVO→CONTACTADO and
  // CONTACTADO→SESION_AGENDADA. Anything else is a person's job in the app.
  const allowed = BOT_TRANSITIONS[lead.etapa];
  if (allowed !== etapa) {
    return NextResponse.json(
      {
        error:
          "El bot solo puede mover NUEVO→CONTACTADO y CONTACTADO→SESION_AGENDADA. Las etapas posteriores se gestionan en la app.",
        etapaActual: lead.etapa,
        etapaPermitida: allowed ?? null,
      },
      { status: 422 },
    );
  }

  const from = lead.etapa;
  const now = new Date();

  const updated = await db.lead.update({
    where: { id: lead.id },
    data: { etapa, fechaUltimoMovimiento: now },
  });

  if (nota) {
    await db.leadNota.create({
      data: { leadId: lead.id, contenido: (BOT_NOTE_PREFIX + nota).slice(0, 2000) },
    });
  }

  // Attribute the movement to the lead's owner (API-key calls have no user).
  logActivity({
    userId: lead.duenoId,
    organizationId,
    action: "lead.move.bot",
    detail: `${lead.nombre}: ${from} → ${etapa} (Bot WhatsApp)`,
  });

  return NextResponse.json({
    ok: true,
    leadId: updated.id,
    etapa: updated.etapa,
    etapaAnterior: from,
    changed: true,
  });
}
