import { NextRequest, NextResponse } from "next/server";
import type { LeadEtapa, Prisma, ReceivableTipo, Venta } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { parseFechaMX } from "@/lib/day";

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
const CIERRE_GANADO = "Cierre ganado";

/** Thrown inside the transaction when the lead moved under us (rolls it back). */
class StaleMoveError extends Error {}

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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const etapa = body.etapa as LeadEtapa;
  if (!ETAPAS.includes(etapa)) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }

  const from = lead.etapa;
  // Moving to the stage it is already in is a no-op (avoids re-running side effects).
  if (from === etapa) {
    return NextResponse.json({ lead, venta: null });
  }

  const now = new Date();
  const leadData: Prisma.LeadUpdateManyMutationInput = { etapa, fechaUltimoMovimiento: now };
  let ganado: { monto: number; tipo: ReceivableTipo; fechaCobroEsperada: Date } | null = null;

  if (etapa === "CERRADO_GANADO") {
    const monto = Number(body.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ error: "El monto es obligatorio y debe ser mayor a 0" }, { status: 400 });
    }
    const tipo = body.tipo as ReceivableTipo;
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ error: "El tipo es obligatorio (RECURRENTE o UNICA)" }, { status: 400 });
    }
    const fechaCobroEsperada = parseFechaMX(body.fechaCobroEsperada);
    if (!fechaCobroEsperada) {
      return NextResponse.json({ error: "La fecha de cobro esperada es obligatoria" }, { status: 400 });
    }
    ganado = { monto, tipo, fechaCobroEsperada };
  } else if (etapa === "CERRADO_PERDIDO") {
    const motivo = (body.motivo ?? "").toString().trim();
    if (!motivo) {
      return NextResponse.json({ error: "El motivo de pérdida es obligatorio" }, { status: 400 });
    }
    leadData.motivoPerdida = motivo;
  }

  // Venta creation + lead update happen atomically. The lead update is a
  // compare-and-set on the stage we read (`from`), so a double click or two
  // concurrent moves can only apply once; the loser gets a 409 and its venta
  // insert is rolled back.
  const result = await db.$transaction(async (tx) => {
    let venta: Venta | null = null;

    if (etapa === "DIAGNOSTICO_VENDIDO") {
      // One-time diagnostic sale, guarded by the flag (claimed atomically).
      const claimed = await tx.lead.updateMany({
        where: { id: lead.id, diagnosticoVentaGenerada: false },
        data: { diagnosticoVentaGenerada: true },
      });
      if (claimed.count === 1) {
        venta = await tx.venta.create({
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
      }
    } else if (ganado) {
      // A lead only ever has one "Cierre ganado" venta: moving out of GANADO and
      // back must not duplicate the sale.
      const existing = await tx.venta.findFirst({
        where: { leadId: lead.id, organizationId: orgId, concepto: CIERRE_GANADO },
      });
      if (!existing) {
        venta = await tx.venta.create({
          data: {
            monto: ganado.monto,
            tipo: ganado.tipo,
            concepto: CIERRE_GANADO,
            fechaCobroEsperada: ganado.fechaCobroEsperada,
            leadId: lead.id,
            vendedorId: lead.duenoId,
            origen: lead.origen,
            fechaCierre: now,
            organizationId: orgId,
          },
        });
      }
    }

    const moved = await tx.lead.updateMany({
      where: { id: lead.id, organizationId: orgId, etapa: from },
      data: leadData,
    });
    if (moved.count !== 1) throw new StaleMoveError();

    const updated = await tx.lead.findUniqueOrThrow({ where: { id: lead.id } });
    return { updated, venta };
  }).catch((err: unknown) => {
    if (err instanceof StaleMoveError) return null;
    throw err;
  });

  if (!result) {
    return NextResponse.json(
      { error: "El lead cambió de etapa mientras lo movías; recarga e intenta de nuevo" },
      { status: 409 },
    );
  }
  const { updated, venta } = result;

  logActivity({
    userId,
    organizationId: orgId,
    action: "lead.move",
    detail: `${lead.nombre}: ${from} → ${etapa}`,
  });

  return NextResponse.json({ lead: updated, venta });
}
