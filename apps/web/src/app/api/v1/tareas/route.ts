import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { currentMonthMX, dayRangeMX, fechaMX, isValidDate, parseFechaMX } from "@/lib/day";

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

  // Date range applies to fechaLimite. Bare "YYYY-MM-DD" bounds are whole days
  // in America/Mexico_City; full timestamps are used as given.
  const range: Prisma.DateTimeFilter = {};
  if (desde) {
    if (isValidDate(desde)) range.gte = dayRangeMX(desde).start;
    else if (!Number.isNaN(new Date(desde).getTime())) range.gte = new Date(desde);
  }
  if (hasta) {
    if (isValidDate(hasta)) range.lt = dayRangeMX(hasta).end;
    else if (!Number.isNaN(new Date(hasta).getTime())) range.lte = new Date(hasta);
  }
  if (range.gte || range.lt || range.lte) where.fechaLimite = range;

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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo ?? body.descripcion ?? "").trim();
  if (!titulo) return NextResponse.json({ error: "El campo 'titulo' es obligatorio." }, { status: 400 });

  const clienteId = String(body.clienteId ?? "").trim();
  if (!clienteId) return NextResponse.json({ error: "El campo 'clienteId' es obligatorio." }, { status: 400 });
  const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  // fechaLimite optional; the month is derived from it (or today).
  // A bare "YYYY-MM-DD" is that day in Mexico (stored at local noon).
  let fechaLimite: Date | null = null;
  if (body.fechaLimite) {
    fechaLimite = parseFechaMX(body.fechaLimite);
    if (!fechaLimite) {
      return NextResponse.json({ error: "fechaLimite inválida (usa YYYY-MM-DD)." }, { status: 400 });
    }
  }
  const rawFecha = String(body.fechaLimite ?? "").trim();
  const mes = isValidDate(rawFecha)
    ? rawFecha.slice(0, 7)
    : fechaLimite
      ? fechaMX(fechaLimite).slice(0, 7)
      : currentMonthMX();

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
