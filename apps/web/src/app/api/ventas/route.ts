import { NextRequest, NextResponse } from "next/server";
import type { LeadOrigen, ReceivableTipo, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const TIPOS = ["RECURRENTE", "UNICA"] as const;
const ORIGENES = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"] as const;

export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "ventas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  // Row-level: Comercial only sees their own sales.
  const where: Prisma.VentaWhereInput = { organizationId: orgId };
  if (jobRole === "COMERCIAL") where.vendedorId = userId;

  const rows = await db.venta.findMany({
    where,
    orderBy: { fechaCierre: "desc" },
    include: {
      vendedor: { select: { id: true, name: true, email: true } },
      cliente: { select: { id: true, nombre: true } },
      lead: { select: { id: true, nombre: true } },
    },
  });

  const ventas = rows.map((v) => ({
    id: v.id,
    monto: v.monto,
    tipo: v.tipo,
    concepto: v.concepto,
    fechaCierre: v.fechaCierre,
    fechaCobroEsperada: v.fechaCobroEsperada,
    origen: v.origen,
    leadId: v.leadId,
    leadNombre: v.lead?.nombre ?? null,
    clienteId: v.clienteId,
    clienteNombre: v.cliente?.nombre ?? null,
    vendedorId: v.vendedorId,
    vendedorNombre: v.vendedor?.name ?? v.vendedor?.email ?? null,
  }));

  // Totals: current month and all-time.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totals = ventas.reduce(
    (acc, v) => {
      acc.totalCount += 1;
      acc.totalMonto += v.monto;
      if (new Date(v.fechaCierre) >= monthStart) {
        acc.mesCount += 1;
        acc.mesMonto += v.monto;
      }
      return acc;
    },
    { mesCount: 0, mesMonto: 0, totalCount: 0, totalMonto: 0 },
  );

  return NextResponse.json({ ventas, totals });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "ventas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  // Manual sale capture is restricted to Dirección.
  if (jobRole !== "DIRECCION") {
    return NextResponse.json({ error: "Solo Dirección puede capturar ventas manuales" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "El monto es obligatorio y debe ser mayor a 0" }, { status: 400 });
  }

  const tipo = body.tipo as ReceivableTipo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "El tipo es obligatorio (RECURRENTE o UNICA)" }, { status: 400 });
  }

  if (!body.fechaCierre || Number.isNaN(new Date(body.fechaCierre).getTime())) {
    return NextResponse.json({ error: "La fecha de cierre es obligatoria" }, { status: 400 });
  }

  let clienteId: string | null = null;
  if (body.clienteId) {
    const cliente = await db.cliente.findFirst({ where: { id: String(body.clienteId), organizationId: orgId } });
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
    clienteId = String(body.clienteId);
  }

  let vendedorId: string | null = null;
  if (body.vendedorId) {
    const member = await db.membership.findFirst({
      where: { userId: String(body.vendedorId), organizationId: orgId },
    });
    if (!member) return NextResponse.json({ error: "Vendedor no válido" }, { status: 400 });
    vendedorId = String(body.vendedorId);
  }

  let origen: LeadOrigen | null = null;
  if (body.origen) {
    if (!ORIGENES.includes(body.origen)) return NextResponse.json({ error: "Origen inválido" }, { status: 400 });
    origen = body.origen as LeadOrigen;
  }

  const created = await db.venta.create({
    data: {
      organizationId: orgId,
      monto,
      tipo,
      concepto: body.concepto ? String(body.concepto).trim() : null,
      clienteId,
      vendedorId,
      origen,
      fechaCierre: new Date(body.fechaCierre),
      fechaCobroEsperada: body.fechaCobroEsperada ? new Date(body.fechaCobroEsperada) : null,
    },
  });

  logActivity({ userId, organizationId: orgId, action: "venta.manual", detail: `Venta manual ${monto}` });

  return NextResponse.json({ venta: created }, { status: 201 });
}
