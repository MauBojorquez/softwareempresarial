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
    },
  });

  const receivables = rows.map((r) => {
    const status = receivableStatus(r.pagado, r.issueDate);
    const saldo = calcSaldo(r.amount, r.pagado);
    return {
      id: r.id,
      clienteId: r.clienteId,
      clienteManual: r.clienteManual,
      clienteNombre: r.cliente?.nombre ?? r.clienteManual ?? null,
      tipo: r.tipo,
      vendedorId: r.vendedorId,
      vendedorNombre: r.vendedor?.name ?? r.vendedor?.email ?? null,
      invoiceFolio: r.invoiceFolio,
      concept: r.concept,
      amount: r.amount,
      issueDate: r.issueDate,
      notes: r.notes,
      pagado: r.pagado,
      fechaPago: r.fechaPago,
      saldo,
      status,
    };
  });

  const totals = receivables.reduce(
    (acc, r) => {
      if (r.pagado) {
        acc.cobrado += r.amount;
        acc.pagadas += 1;
      } else {
        acc.porCobrar += r.amount;
        acc.pendientes += 1;
        if (r.status === "VENCIDA") {
          acc.vencido += r.amount;
          acc.vencidas += 1;
        }
      }
      if (r.tipo === "RECURRENTE") {
        if (r.pagado) acc.recurrente.cobrado += r.amount;
        else acc.recurrente.porCobrar += r.amount;
      } else if (r.tipo === "UNICA") {
        if (r.pagado) acc.unica.cobrado += r.amount;
        else acc.unica.porCobrar += r.amount;
      }
      return acc;
    },
    {
      porCobrar: 0,
      cobrado: 0,
      vencido: 0,
      pagadas: 0,
      pendientes: 0,
      vencidas: 0,
      recurrente: { cobrado: 0, porCobrar: 0 },
      unica: { cobrado: 0, porCobrar: 0 },
    },
  );

  const [members, clientes] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.cliente.findMany({
      where: { organizationId: orgId },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return NextResponse.json({
    receivables,
    totals,
    members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
    clientes,
  });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));

  const clienteId = (body.clienteId ?? "").toString().trim();
  const clienteManual = (body.clienteManual ?? "").toString().trim();

  let resolvedClienteId: string | null = null;
  let resolvedClienteManual: string | null = null;
  if (clienteId) {
    const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId: orgId } });
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
    resolvedClienteId = clienteId;
  } else if (clienteManual) {
    resolvedClienteManual = clienteManual;
  } else {
    return NextResponse.json({ error: "Selecciona un cliente o escribe un nombre" }, { status: 400 });
  }

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
  const pagado = body.pagado === true;
  const fechaPago = pagado ? (body.fechaPago ? new Date(body.fechaPago) : new Date()) : null;

  const created = await db.receivable.create({
    data: {
      organizationId: orgId,
      clienteId: resolvedClienteId,
      clienteManual: resolvedClienteManual,
      tipo,
      vendedorId,
      invoiceFolio: body.invoiceFolio ? String(body.invoiceFolio).trim() : null,
      concept: body.concept ? String(body.concept).trim() : null,
      amount: Number.isFinite(amount) ? amount : 0,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      notes: body.notes ? String(body.notes).trim() : null,
      pagado,
      fechaPago,
    },
  });

  return NextResponse.json({ receivable: created }, { status: 201 });
}
