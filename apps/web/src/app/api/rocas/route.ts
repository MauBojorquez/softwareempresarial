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
  usaChecklist: boolean;
  mes: string;
  duenoId: string;
  dueno?: { name: string | null; email: string } | null;
  checklist?: { id: string; titulo: string; done: boolean; order: number }[];
}) {
  return {
    id: r.id,
    titulo: r.titulo,
    metricaExito: r.metricaExito,
    fechaLimite: r.fechaLimite,
    estatus: r.estatus,
    porcentajeAvance: r.porcentajeAvance,
    usaChecklist: r.usaChecklist,
    mes: r.mes,
    duenoId: r.duenoId,
    duenoNombre: r.dueno?.name ?? r.dueno?.email ?? null,
    checklist: (r.checklist ?? []).map((i) => ({
      id: i.id,
      titulo: i.titulo,
      done: i.done,
      order: i.order,
    })),
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
    include: {
      dueno: { select: { name: true, email: true } },
      checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
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

  const usaChecklist = body.usaChecklist === true;

  // Optional initial checklist item titles.
  const itemTitulos: string[] = Array.isArray(body.items)
    ? body.items.map((t: unknown) => String(t ?? "").trim()).filter((t: string) => t.length > 0)
    : [];

  let porcentajeAvance = 0;
  if (usaChecklist) {
    // Derived from items: all start undone, so 0 regardless of count.
    porcentajeAvance = 0;
  } else if (body.porcentajeAvance !== undefined && body.porcentajeAvance !== null && body.porcentajeAvance !== "") {
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
      usaChecklist,
      mes,
      duenoId,
      ...(usaChecklist && itemTitulos.length > 0
        ? {
            checklist: {
              create: itemTitulos.map((t, i) => ({ titulo: t.slice(0, 300), order: i })),
            },
          }
        : {}),
    },
    include: {
      dueno: { select: { name: true, email: true } },
      checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });

  logActivity({ userId, organizationId: orgId, action: "roca.create", detail: titulo });

  return NextResponse.json({ roca: shape(roca) }, { status: 201 });
}
