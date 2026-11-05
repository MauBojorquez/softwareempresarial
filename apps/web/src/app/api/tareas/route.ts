import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { currentMonthMX, fechaMX, isValidDate, parseFechaMX } from "@/lib/day";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

// GET /api/tareas?mes=YYYY-MM — list tareas (optionally by month) plus the
// month's "velocidad" (completadas/total). With a month, `anteriores` also
// carries every PENDIENTE tarea from earlier months (oldest first) so unfinished
// work is never lost when a new month starts. Gated by "tareas".
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "tareas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mesParam = req.nextUrl.searchParams.get("mes");
  const mes = mesParam && MES_RE.test(mesParam) ? mesParam : null;
  const where: { organizationId: string; mes?: string } = { organizationId: orgId };
  if (mes) where.mes = mes;

  const include = {
    cliente: { select: { id: true, nombre: true } },
    responsable: { select: { id: true, name: true, email: true } },
  } as const;

  const [rows, prevRows] = await Promise.all([
    db.tarea.findMany({ where, orderBy: [{ createdAt: "desc" }], include }),
    mes
      ? db.tarea.findMany({
          where: { organizationId: orgId, estatus: "PENDIENTE", mes: { lt: mes } },
          orderBy: [{ mes: "asc" }, { fechaLimite: "asc" }, { createdAt: "asc" }],
          include,
        })
      : Promise.resolve([]),
  ]);

  const shape = (t: (typeof rows)[number]) => ({
    id: t.id,
    descripcion: t.descripcion,
    mes: t.mes,
    fechaLimite: t.fechaLimite,
    estatus: t.estatus,
    fechaCompletada: t.fechaCompletada,
    clienteId: t.clienteId,
    clienteNombre: t.cliente?.nombre ?? null,
    responsableId: t.responsableId,
    responsableNombre: t.responsable?.name ?? t.responsable?.email ?? null,
    createdAt: t.createdAt,
  });

  const tareas = rows.map(shape);
  const anteriores = prevRows.map(shape);

  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estatus === "COMPLETADA").length;
  const velocidad = {
    total,
    completadas,
    ratio: total > 0 ? completadas / total : 0,
  };

  // Members available as responsables (used by the UI dropdown).
  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    tareas,
    anteriores,
    velocidad,
    members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
  });
}

// POST /api/tareas — create a tarea. Gated by "tareas".
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "tareas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const descripcion = (body.descripcion ?? "").toString().trim();
  if (!descripcion) return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });

  const clienteId = (body.clienteId ?? "").toString().trim();
  if (!clienteId) return NextResponse.json({ error: "El cliente es obligatorio" }, { status: 400 });

  const cliente = await db.cliente.findFirst({ where: { id: clienteId, organizationId: orgId } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });

  // A bare "YYYY-MM-DD" is that day in Mexico (stored at local noon).
  let fechaLimite: Date | null = null;
  if (body.fechaLimite !== undefined && body.fechaLimite !== null && body.fechaLimite !== "") {
    fechaLimite = parseFechaMX(body.fechaLimite);
    if (!fechaLimite) return NextResponse.json({ error: "Fecha límite inválida" }, { status: 400 });
  }

  // Default month: the fechaLimite's month (as typed), else the current MX month.
  let mes = (body.mes ?? "").toString().trim();
  if (!mes) {
    const raw = String(body.fechaLimite ?? "").trim();
    mes = isValidDate(raw) ? raw.slice(0, 7) : fechaLimite ? fechaMX(fechaLimite).slice(0, 7) : currentMonthMX();
  }
  if (!MES_RE.test(mes)) return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM" }, { status: 400 });

  let responsableId: string | null = null;
  if (body.responsableId) {
    const member = await db.membership.findFirst({
      where: { userId: String(body.responsableId), organizationId: orgId },
    });
    if (!member) return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
    responsableId = String(body.responsableId);
  }

  const tarea = await db.tarea.create({
    data: {
      organizationId: orgId,
      clienteId,
      descripcion,
      mes,
      fechaLimite,
      responsableId,
    },
  });

  return NextResponse.json({ tarea }, { status: 201 });
}
