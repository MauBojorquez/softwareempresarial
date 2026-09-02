import { NextRequest, NextResponse } from "next/server";
import type { Salud } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { currentMonthMX } from "@/lib/day";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;
const SALUD = ["VERDE", "AMARILLO", "ROJO"] as const;

function shape(r: {
  id: string;
  titulo: string;
  metricaExito: string;
  fechaLimite: Date;
  estatus: Salud;
  porcentajeAvance: number;
  mes: string;
  duenoId: string;
  dueno?: { name: string | null; email: string } | null;
}) {
  return {
    id: r.id,
    titulo: r.titulo,
    metricaExito: r.metricaExito,
    fechaLimite: r.fechaLimite,
    estatus: r.estatus,
    porcentajeAvance: r.porcentajeAvance,
    mes: r.mes,
    duenoId: r.duenoId,
    duenoNombre: r.dueno?.name ?? r.dueno?.email ?? null,
  };
}

// GET /api/rocas?mes=YYYY-MM — list the month's rocas (all roles see all rocas).
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mesParam = req.nextUrl.searchParams.get("mes");
  const mes = mesParam && MES_RE.test(mesParam) ? mesParam : currentMonthMX();

  const rows = await db.roca.findMany({
    where: { organizationId: orgId, mes },
    orderBy: [{ createdAt: "asc" }],
    include: { dueno: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ mes, rocas: rows.map(shape) });
}

// POST /api/rocas — create a roca (DIRECCION only).
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "rocas");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  if (jobRole !== "DIRECCION") {
    return NextResponse.json({ error: "Solo Dirección puede crear rocas" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const titulo = (body.titulo ?? "").toString().trim();
  if (!titulo) return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });

  const metricaExito = (body.metricaExito ?? "").toString().trim();
  if (!metricaExito) return NextResponse.json({ error: "La métrica de éxito es obligatoria" }, { status: 400 });

  if (!body.fechaLimite || Number.isNaN(new Date(body.fechaLimite).getTime())) {
    return NextResponse.json({ error: "La fecha límite es obligatoria" }, { status: 400 });
  }

  const duenoId = (body.duenoId ?? "").toString().trim();
  if (!duenoId) return NextResponse.json({ error: "El dueño es obligatorio" }, { status: 400 });
  const member = await db.membership.findFirst({ where: { userId: duenoId, organizationId: orgId } });
  if (!member) return NextResponse.json({ error: "Dueño no válido" }, { status: 400 });

  let mes = (body.mes ?? "").toString().trim();
  if (!mes) mes = currentMonthMX();
  if (!MES_RE.test(mes)) return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM" }, { status: 400 });

  const estatus: Salud = SALUD.includes(body.estatus) ? body.estatus : "VERDE";

  let porcentajeAvance = 0;
  if (body.porcentajeAvance !== undefined && body.porcentajeAvance !== null && body.porcentajeAvance !== "") {
    const p = Number(body.porcentajeAvance);
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      return NextResponse.json({ error: "El porcentaje de avance debe ser un entero entre 0 y 100" }, { status: 400 });
    }
    porcentajeAvance = p;
  }

  const roca = await db.roca.create({
    data: {
      organizationId: orgId,
      titulo,
      metricaExito,
      fechaLimite: new Date(body.fechaLimite),
      estatus,
      porcentajeAvance,
      mes,
      duenoId,
    },
    include: { dueno: { select: { name: true, email: true } } },
  });

  logActivity({ userId, organizationId: orgId, action: "roca.create", detail: titulo });

  return NextResponse.json({ roca: shape(roca) }, { status: 201 });
}
