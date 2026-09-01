import { NextRequest, NextResponse } from "next/server";
import type { ClienteEstatus, Salud } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const ESTATUS = ["ACTIVO", "ESPERA", "VENCIDO", "BAJA"] as const;
const SALUD = ["VERDE", "AMARILLO", "ROJO"] as const;

// GET /api/clientes — list clientes for the active org (gated by "cartera").
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "cartera");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const clientes = await db.cliente.findMany({
    where: { organizationId: orgId },
    orderBy: [{ nombre: "asc" }],
  });

  return NextResponse.json({ clientes });
}

// POST /api/clientes — create a cliente (gated by "clientes").
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "clientes");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));

  const nombre = (body.nombre ?? "").toString().trim();
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const montoMensual = Number(body.montoMensual);
  if (!Number.isFinite(montoMensual) || montoMensual < 0) {
    return NextResponse.json({ error: "El monto mensual debe ser un número mayor o igual a 0" }, { status: 400 });
  }

  let diaDePago: number | null = null;
  if (body.diaDePago !== undefined && body.diaDePago !== null && body.diaDePago !== "") {
    const d = Number(body.diaDePago);
    if (!Number.isInteger(d) || d < 1 || d > 31) {
      return NextResponse.json({ error: "El día de pago debe ser un entero entre 1 y 31" }, { status: 400 });
    }
    diaDePago = d;
  }

  const estatus: ClienteEstatus = ESTATUS.includes(body.estatus) ? body.estatus : "ACTIVO";
  const salud: Salud = SALUD.includes(body.salud) ? body.salud : "VERDE";

  const cliente = await db.cliente.create({
    data: {
      organizationId: orgId,
      nombre,
      contacto: body.contacto ? String(body.contacto).trim() : null,
      montoMensual,
      diaDePago,
      estatus,
      salud,
      notas: body.notas ? String(body.notas).trim() : null,
    },
  });

  return NextResponse.json({ cliente }, { status: 201 });
}
