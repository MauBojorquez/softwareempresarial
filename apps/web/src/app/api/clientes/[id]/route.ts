import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const ESTATUS = ["ACTIVO", "ESPERA", "VENCIDO", "BAJA"] as const;
const SALUD = ["VERDE", "AMARILLO", "ROJO"] as const;

async function ownRow(orgId: string, id: string) {
  return db.cliente.findFirst({ where: { id, organizationId: orgId } });
}

// PATCH /api/clientes/[id] — edit a cliente (gated by "clientes").
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "clientes");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    data.nombre = nombre;
  }
  if (body.contacto !== undefined) data.contacto = body.contacto ? String(body.contacto).trim() : null;
  if (body.montoMensual !== undefined) {
    const montoMensual = Number(body.montoMensual);
    if (!Number.isFinite(montoMensual) || montoMensual < 0) {
      return NextResponse.json({ error: "El monto mensual debe ser un número mayor o igual a 0" }, { status: 400 });
    }
    data.montoMensual = montoMensual;
  }
  if (body.diaDePago !== undefined) {
    if (body.diaDePago === null || body.diaDePago === "") {
      data.diaDePago = null;
    } else {
      const d = Number(body.diaDePago);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return NextResponse.json({ error: "El día de pago debe ser un entero entre 1 y 31" }, { status: 400 });
      }
      data.diaDePago = d;
    }
  }
  if (body.estatus !== undefined) {
    if (!ESTATUS.includes(body.estatus)) return NextResponse.json({ error: "Estatus inválido" }, { status: 400 });
    data.estatus = body.estatus;
  }
  if (body.salud !== undefined) {
    if (!SALUD.includes(body.salud)) return NextResponse.json({ error: "Salud inválida" }, { status: 400 });
    data.salud = body.salud;
  }
  if (body.notas !== undefined) data.notas = body.notas ? String(body.notas).trim() : null;

  const cliente = await db.cliente.update({ where: { id: params.id }, data });
  return NextResponse.json({ cliente });
}

// DELETE /api/clientes/[id] — soft "baja" (estatus = BAJA). Hard-deletes only
// when the cliente has no receivables and no tareas (nothing to preserve).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "clientes");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [receivables, tareas] = await Promise.all([
    db.receivable.count({ where: { clienteId: params.id } }),
    db.tarea.count({ where: { clienteId: params.id } }),
  ]);

  if (receivables === 0 && tareas === 0) {
    await db.cliente.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const cliente = await db.cliente.update({ where: { id: params.id }, data: { estatus: "BAJA" } });
  return NextResponse.json({
    ok: true,
    deleted: false,
    cliente,
    note: "El cliente tiene registros asociados; se marcó como BAJA en lugar de eliminarse.",
  });
}
