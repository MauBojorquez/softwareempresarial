import { NextRequest, NextResponse } from "next/server";
import type { LeadEtapa, ReceivableTipo, Venta } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
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

const TIPOS = ["RECURRENTE", "UNICA"] as const;

const DIAGNOSTICO_MONTO = 9997;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const lead = await db.lead.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Marketing may only move their own leads.
  if (jobRole === "MARKETING" && lead.duenoId !== userId) {
    return NextResponse.json({ error: "Solo puedes mover tus propios leads" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const etapa = body.etapa as LeadEtapa;
  if (!ETAPAS.includes(etapa)) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }

  const from = lead.etapa;
  const now = new Date();
  const leadData: Record<string, unknown> = { etapa, fechaUltimoMovimiento: now };
  let venta: Venta | null = null;

  if (etapa === "DIAGNOSTICO_VENDIDO") {
    // Auto-generate the one-time diagnostic sale, but only once per lead.
    if (!lead.diagnosticoVentaGenerada) {
      venta = await db.venta.create({
        data: {
          monto: DIAGNOSTICO_MONTO,
          tipo: "UNICA",
          concepto: "Diagnóstico vendido",
          leadId: lead.id,
          vendedorId: lead.duenoId,
          origen: lead.origen,
          fechaCierre: now,
          organizationId: orgId,
        },
      });
      leadData.diagnosticoVentaGenerada = true;
    }
  } else if (etapa === "CERRADO_GANADO") {
    const monto = Number(body.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ error: "El monto es obligatorio y debe ser mayor a 0" }, { status: 400 });
    }
    const tipo = body.tipo as ReceivableTipo;
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ error: "El tipo es obligatorio (RECURRENTE o UNICA)" }, { status: 400 });
    }
    if (!body.fechaCobroEsperada || Number.isNaN(new Date(body.fechaCobroEsperada).getTime())) {
      return NextResponse.json({ error: "La fecha de cobro esperada es obligatoria" }, { status: 400 });
    }
    venta = await db.venta.create({
      data: {
        monto,
        tipo,
        concepto: "Cierre ganado",
        fechaCobroEsperada: new Date(body.fechaCobroEsperada),
        leadId: lead.id,
        vendedorId: lead.duenoId,
        origen: lead.origen,
        fechaCierre: now,
        organizationId: orgId,
      },
    });
  } else if (etapa === "CERRADO_PERDIDO") {
    const motivo = (body.motivo ?? "").toString().trim();
    if (!motivo) {
      return NextResponse.json({ error: "El motivo de pérdida es obligatorio" }, { status: 400 });
    }
    leadData.motivoPerdida = motivo;
  }

  const updated = await db.lead.update({ where: { id: lead.id }, data: leadData });

  logActivity({
    userId,
    organizationId: orgId,
    action: "lead.move",
    detail: `${lead.nombre}: ${from} → ${etapa}`,
  });

  return NextResponse.json({ lead: updated, venta });
}
