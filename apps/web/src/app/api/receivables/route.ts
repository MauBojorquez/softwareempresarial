import { NextRequest, NextResponse } from "next/server";
import type { ReceivableTipo } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { receivableStatus, saldo as calcSaldo } from "@/lib/cobranza";
import { currentMonthMX, monthRangeMX, parseFechaMX } from "@/lib/day";
import { ensureMonthStarted } from "@/server/services/month/start";

export const dynamic = "force-dynamic";

const TIPOS = ["RECURRENTE", "UNICA"] as const;
const MES_RE = /^\d{4}-\d{2}$/;

const include = {
  cliente: { select: { id: true, nombre: true } },
  vendedor: { select: { id: true, name: true, email: true } },
} as const;

// GET /api/receivables?mes=YYYY-MM (default: current month, Mexico City).
// Returns that month's invoices + totals, and every still-unpaid invoice from
// earlier months under `anteriores` so nothing pending gets lost.
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mesParam = req.nextUrl.searchParams.get("mes");
  const mes = mesParam && MES_RE.test(mesParam) ? mesParam : currentMonthMX();
  const { start, end } = monthRangeMX(mes);

  try {
    await ensureMonthStarted(orgId);
  } catch (e) {
    // Never block Cobranza on the month start; it retries on the next read.
    console.error("month start failed:", e);
  }

  const [rows, prevRows] = await Promise.all([
    db.receivable.findMany({
      where: { organizationId: orgId, issueDate: { gte: start, lt: end } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      include,
    }),
    db.receivable.findMany({
      where: { organizationId: orgId, pagado: false, issueDate: { lt: start } },
      orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
      include,
    }),
  ]);

  const shape = (r: (typeof rows)[number]) => {
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
  };
  const receivables = rows.map(shape);
  const anteriores = prevRows.map(shape);

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
    mes,
    receivables,
    totals,
    anteriores,
    anterioresTotal: anteriores.reduce((s, r) => s + r.amount, 0),
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
  const fechaPago = pagado ? parseFechaMX(body.fechaPago) ?? new Date() : null;
  const issueDate = body.issueDate ? parseFechaMX(body.issueDate) : new Date();
  if (!issueDate) return NextResponse.json({ error: "Fecha de emisión inválida" }, { status: 400 });

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
      issueDate,
      notes: body.notes ? String(body.notes).trim() : null,
      pagado,
      fechaPago,
    },
  });

  return NextResponse.json({ receivable: created }, { status: 201 });
}
