import { NextRequest, NextResponse } from "next/server";
import type { ReceivableTipo } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const TIPOS = ["RECURRENTE", "UNICA"] as const;

async function ownRow(orgId: string, id: string) {
  return db.receivable.findFirst({ where: { id, organizationId: orgId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.clienteId !== undefined) {
    const clienteId = String(body.clienteId ?? "").trim();
    if (!clienteId) {
      data.clienteId = null;
    } else {
      const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId: orgId } });
      if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
      data.clienteId = clienteId;
      data.clienteManual = null;
    }
  }
  if (body.clienteManual !== undefined) {
    const manual = String(body.clienteManual ?? "").trim();
    data.clienteManual = manual || null;
    if (manual) data.clienteId = null;
  }
  if (body.pagado !== undefined) {
    const pagado = body.pagado === true;
    data.pagado = pagado;
    if (pagado) {
      data.fechaPago = body.fechaPago ? new Date(body.fechaPago) : new Date();
    } else {
      data.fechaPago = null;
    }
  }
  if (body.tipo !== undefined) {
    if (!TIPOS.includes(body.tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    data.tipo = body.tipo as ReceivableTipo;
  }
  if (body.vendedorId !== undefined) {
    if (!body.vendedorId) {
      data.vendedorId = null;
    } else {
      const member = await db.membership.findFirst({
        where: { userId: String(body.vendedorId), organizationId: orgId },
      });
      if (!member) return NextResponse.json({ error: "Vendedor no válido" }, { status: 400 });
      data.vendedorId = String(body.vendedorId);
    }
  }
  if (body.invoiceFolio !== undefined) data.invoiceFolio = body.invoiceFolio ? String(body.invoiceFolio).trim() : null;
  if (body.concept !== undefined) data.concept = body.concept ? String(body.concept).trim() : null;
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    data.amount = Number.isFinite(amount) ? amount : 0;
  }
  if (body.issueDate !== undefined) data.issueDate = new Date(body.issueDate);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;

  const updated = await db.receivable.update({ where: { id: params.id }, data });
  return NextResponse.json({ receivable: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.receivable.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
