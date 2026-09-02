import { NextRequest, NextResponse } from "next/server";
import type { LeadOrigen } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseEmail, parsePhone } from "@/lib/lead-contact";

export const dynamic = "force-dynamic";

const ORIGENES = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const lead = await db.lead.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Marketing may only edit their own leads.
  if (jobRole === "MARKETING" && lead.duenoId !== userId) {
    return NextResponse.json({ error: "Solo puedes editar tus propios leads" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    data.nombre = nombre;
  }
  if (body.empresa !== undefined) data.empresa = body.empresa ? String(body.empresa).trim() : null;
  if (body.contacto !== undefined) data.contacto = body.contacto ? String(body.contacto).trim() : null;
  if (body.telefono !== undefined) {
    const r = parsePhone(body.telefono);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    data.telefono = r.value;
  }
  if (body.email !== undefined) {
    const r = parseEmail(body.email);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    data.email = r.value;
  }
  if (body.origen !== undefined) {
    if (!ORIGENES.includes(body.origen)) return NextResponse.json({ error: "Origen inválido" }, { status: 400 });
    data.origen = body.origen as LeadOrigen;
  }
  if (body.duenoId !== undefined) {
    const member = await db.membership.findFirst({
      where: { userId: String(body.duenoId), organizationId: orgId },
    });
    if (!member) return NextResponse.json({ error: "Dueño no válido" }, { status: 400 });
    data.duenoId = String(body.duenoId);
  }
  if (body.valorEstimado !== undefined) {
    if (body.valorEstimado === null || body.valorEstimado === "") {
      data.valorEstimado = null;
    } else {
      const n = Number(body.valorEstimado);
      data.valorEstimado = Number.isFinite(n) ? n : null;
    }
  }
  if (body.valorMensualEstimado !== undefined) {
    if (body.valorMensualEstimado === null || body.valorMensualEstimado === "") {
      data.valorMensualEstimado = null;
    } else {
      const n = Number(body.valorMensualEstimado);
      data.valorMensualEstimado = Number.isFinite(n) ? n : null;
    }
  }

  const updated = await db.lead.update({ where: { id: params.id }, data });
  return NextResponse.json({ lead: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const lead = await db.lead.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (jobRole === "MARKETING" && lead.duenoId !== userId) {
    return NextResponse.json({ error: "Solo puedes eliminar tus propios leads" }, { status: 403 });
  }

  await db.lead.delete({ where: { id: params.id } });
  logActivity({ userId, organizationId: orgId, action: "lead.delete", detail: lead.nombre });
  return NextResponse.json({ ok: true });
}
