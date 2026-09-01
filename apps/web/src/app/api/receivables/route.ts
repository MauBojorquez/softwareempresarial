import { NextRequest, NextResponse } from "next/server";
import type { ReceivableTipo } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { receivableStatus, saldo as calcSaldo } from "@/lib/cobranza";

export const dynamic = "force-dynamic";

const TIPOS = ["RECURRENTE", "UNICA"] as const;

export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const rows = await db.receivable.findMany({
    where: { organizationId: orgId },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    include: {
      cliente: { select: { id: true, nombre: true } },
      vendedor: { select: { id: true, name: true, email: true } },
      payments: {
        orderBy: { fecha: "desc" },
        include: { registradoPor: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  const receivables = rows.map((r) => {
    const paidTotal = r.payments.reduce((s, p) => s + p.monto, 0);
    const status = receivableStatus(r.amount, paidTotal, r.issueDate);
    const saldo = calcSaldo(r.amount, paidTotal);
    return {
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.cliente?.nombre ?? null,
      tipo: r.tipo,
      vendedorId: r.vendedorId,
      vendedorNombre: r.vendedor?.name ?? r.vendedor?.email ?? null,
      invoiceFolio: r.invoiceFolio,
      concept: r.concept,
      amount: r.amount,
      issueDate: r.issueDate,
      notes: r.notes,
      paidTotal,
      saldo,
      status,
      payments: r.payments.map((p) => ({
        id: p.id,
        monto: p.monto,
        fecha: p.fecha,
        metodo: p.metodo,
        notas: p.notas,
        registradoPorId: p.registradoPorId,
        registradoPorNombre: p.registradoPor?.name ?? p.registradoPor?.email ?? null,
      })),
    };
  });

  const totals = receivables.reduce(
    (acc, r) => {
      acc.cobrado += r.paidTotal;
      if (r.status === "PAGADA") {
        acc.pagadas += 1;
      } else {
        acc.porCobrar += r.saldo;
        acc.pendientes += 1;
        if (r.status === "VENCIDA") {
          acc.vencido += r.saldo;
          acc.vencidas += 1;
        }
      }
      return acc;
    },
    { porCobrar: 0, cobrado: 0, vencido: 0, pagadas: 0, pendientes: 0, vencidas: 0 },
  );

  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    receivables,
    totals,
    members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
  });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));

  const clienteId = (body.clienteId ?? "").toString().trim();
  if (!clienteId) return NextResponse.json({ error: "El cliente es obligatorio" }, { status: 400 });
  const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId: orgId } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });

  const tipo = body.tipo as ReceivableTipo;
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: "El tipo es obligatorio (RECURRENTE o UNICA)" }, { status: 400 });

  let vendedorId: string | null = null;
  if (body.vendedorId) {
    const member = await db.membership.findFirst({
      where: { userId: String(body.vendedorId), organizationId: orgId },
    });
    if (!member) return NextResponse.json({ error: "Vendedor no válido" }, { status: 400 });
    vendedorId = String(body.vendedorId);
  }

  const amount = Number(body.amount);

  const created = await db.receivable.create({
    data: {
      organizationId: orgId,
      clienteId,
      tipo,
      vendedorId,
      invoiceFolio: body.invoiceFolio ? String(body.invoiceFolio).trim() : null,
      concept: body.concept ? String(body.concept).trim() : null,
      amount: Number.isFinite(amount) ? amount : 0,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      notes: body.notes ? String(body.notes).trim() : null,
    },
  });

  return NextResponse.json({ receivable: created }, { status: 201 });
}
