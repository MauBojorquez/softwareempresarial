import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

function shape(t: {
  id: string;
  descripcion: string;
  mes: string;
  fechaLimite: Date | null;
  estatus: string;
  fechaCompletada: Date | null;
  clienteId: string;
  cliente?: { nombre: string } | null;
  responsableId: string | null;
  responsable?: { id: string; name: string | null; email: string; phone: string | null } | null;
  createdAt: Date;
}) {
  return {
    id: t.id,
    titulo: t.descripcion,
    clienteId: t.clienteId,
    clienteNombre: t.cliente?.nombre ?? null,
    estatus: t.estatus,
    fechaLimite: t.fechaLimite,
    fechaCompletada: t.fechaCompletada,
    mes: t.mes,
    responsable: t.responsable
      ? {
          id: t.responsable.id,
          nombre: t.responsable.name,
          correo: t.responsable.email,
          whatsapp: t.responsable.phone,
        }
      : null,
    createdAt: t.createdAt,
  };
}

// GET /api/v1/tareas?clienteId=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estatus=
// Lists tasks, optionally by client and by fechaLimite range. Same API-key auth.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-tareas-read", limit: 240, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const sp = req.nextUrl.searchParams;
  const clienteId = sp.get("clienteId");
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const estatus = sp.get("estatus");

  const where: Prisma.TareaWhereInput = { organizationId };
  if (clienteId) where.clienteId = clienteId;
  if (estatus === "PENDIENTE" || estatus === "COMPLETADA") where.estatus = estatus;

  // Date range applies to fechaLimite.
  const range: Prisma.DateTimeFilter = {};
  if (desde && !Number.isNaN(new Date(desde).getTime())) range.gte = new Date(desde);
  if (hasta && !Number.isNaN(new Date(hasta).getTime())) {
    const end = new Date(hasta);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  if (range.gte || range.lte) where.fechaLimite = range;

  const rows = await db.tarea.findMany({
    where,
    orderBy: [{ fechaLimite: "asc" }, { createdAt: "desc" }],
    include: {
      cliente: { select: { nombre: true } },
      responsable: { select: { id: true, name: true, email: true, phone: true } },
    },
    take: 1000,
  });

  return NextResponse.json({ count: rows.length, tareas: rows.map(shape) });
}

// POST /api/v1/tareas — create a task. Same API-key auth.
// Body: { clienteId, titulo, fechaLimite?, responsableId? | responsableEmail? }
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-tareas-write", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const body = await req.json().catch(() => ({}));

  const titulo = String(body.titulo ?? body.descripcion ?? "").trim();
  if (!titulo) return NextResponse.json({ error: "El campo 'titulo' es obligatorio." }, { status: 400 });

  const clienteId = String(body.clienteId ?? "").trim();
  if (!clienteId) return NextResponse.json({ error: "El campo 'clienteId' es obligatorio." }, { status: 400 });
  const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  // fechaLimite optional; the month is derived from it (or today).
  let fechaLimite: Date | null = null;
  if (body.fechaLimite) {
    const d = new Date(body.fechaLimite);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "fechaLimite inválida (usa YYYY-MM-DD)." }, { status: 400 });
    }
    fechaLimite = d;
  }
  const mes = (fechaLimite ?? new Date()).toISOString().slice(0, 7);

  // Responsable: accept an id or an email; must be a member of the org. Any
  // area can be assigned (e.g. Marketing can carry an Operaciones task).
  let responsableId: string | null = null;
  const rid = body.responsableId ? String(body.responsableId).trim() : "";
  const remail = body.responsableEmail ? String(body.responsableEmail).trim().toLowerCase() : "";
  if (rid || remail) {
    const member = await db.membership.findFirst({
      where: {
        organizationId,
        ...(rid ? { userId: rid } : { user: { email: remail } }),
      },
      select: { userId: true },
    });
    if (!member) return NextResponse.json({ error: "Responsable no válido (no es miembro de la organización)." }, { status: 400 });
    responsableId = member.userId;
  }

  const tarea = await db.tarea.create({
    data: { organizationId, clienteId, descripcion: titulo, mes, fechaLimite, responsableId },
    include: {
      cliente: { select: { nombre: true } },
      responsable: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return NextResponse.json({ tarea: shape(tarea) }, { status: 201 });
}
