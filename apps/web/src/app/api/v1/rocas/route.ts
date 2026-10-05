import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";
import { currentMonthMX } from "@/lib/day";
import { rocaColor } from "@/lib/roca-color";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

const ROCA_INCLUDE: Prisma.RocaInclude = {
  dueno: { select: { id: true, name: true, email: true } },
  checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
};

function shape(r: {
  id: string;
  titulo: string;
  metricaExito: string;
  fechaLimite: Date;
  mes: string;
  porcentajeAvance: number;
  usaChecklist: boolean;
  createdAt: Date;
  dueno: { id: string; name: string | null; email: string };
  checklist: { id: string; titulo: string; done: boolean; order: number }[];
}) {
  return {
    id: r.id,
    titulo: r.titulo,
    metricaExito: r.metricaExito,
    fechaLimite: r.fechaLimite,
    mes: r.mes,
    porcentajeAvance: r.porcentajeAvance,
    usaChecklist: r.usaChecklist,
    // Always derived — never stored/edited manually.
    estatus: rocaColor(r.createdAt, r.fechaLimite, r.porcentajeAvance),
    dueno: { id: r.dueno.id, nombre: r.dueno.name, correo: r.dueno.email },
    checklist: r.checklist.map((i) => ({ id: i.id, titulo: i.titulo, done: i.done, order: i.order })),
    createdAt: r.createdAt,
  };
}

/** Resolves a member of the org by id or email. Returns the userId, null when
 *  neither was provided, or "invalid" when provided but not a member. */
async function resolveDueno(
  organizationId: string,
  duenoId: unknown,
  duenoEmail: unknown,
): Promise<string | null | "invalid"> {
  const rid = duenoId ? String(duenoId).trim() : "";
  const remail = duenoEmail ? String(duenoEmail).trim().toLowerCase() : "";
  if (!rid && !remail) return null;
  const member = await db.membership.findFirst({
    where: { organizationId, ...(rid ? { userId: rid } : { user: { email: remail } }) },
    select: { userId: true },
  });
  return member ? member.userId : "invalid";
}

// GET /api/v1/rocas?mes=YYYY-MM&duenoId=&duenoEmail= — list rocas. Same API-key auth.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-rocas-read", limit: 240, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const sp = req.nextUrl.searchParams;
  const mesParam = sp.get("mes");
  if (mesParam && !MES_RE.test(mesParam)) {
    return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM." }, { status: 400 });
  }
  const mes = mesParam || currentMonthMX();

  const dueno = await resolveDueno(organizationId, sp.get("duenoId"), sp.get("duenoEmail"));
  if (dueno === "invalid") {
    return NextResponse.json({ error: "Responsable no válido (no es miembro de la organización)." }, { status: 400 });
  }

  const rows = await db.roca.findMany({
    where: { organizationId, mes, ...(dueno ? { duenoId: dueno } : {}) },
    orderBy: [{ fechaLimite: "asc" }, { createdAt: "desc" }],
    include: ROCA_INCLUDE,
  });

  return NextResponse.json({ mes, count: rows.length, rocas: rows.map(shape) });
}

// POST /api/v1/rocas — create a roca. Same API-key auth.
// Body: { titulo, metricaExito, fechaLimite, duenoId | duenoEmail, mes?, usaChecklist?,
//         items?, porcentajeAvance? }. `estatus` is ignored: it is always computed.
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-rocas-write", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const body = await req.json().catch(() => ({}));

  const titulo = String(body.titulo ?? "").trim();
  if (!titulo) return NextResponse.json({ error: "El campo 'titulo' es obligatorio." }, { status: 400 });

  const metricaExito = String(body.metricaExito ?? "").trim();
  if (!metricaExito) return NextResponse.json({ error: "El campo 'metricaExito' es obligatorio." }, { status: 400 });

  const fechaLimiteRaw = body.fechaLimite ? String(body.fechaLimite).trim() : "";
  const fechaLimite = fechaLimiteRaw ? new Date(fechaLimiteRaw) : null;
  if (!fechaLimite || Number.isNaN(fechaLimite.getTime())) {
    return NextResponse.json({ error: "El campo 'fechaLimite' es obligatorio (usa YYYY-MM-DD)." }, { status: 400 });
  }

  const duenoId = await resolveDueno(organizationId, body.duenoId, body.duenoEmail);
  if (duenoId === null) {
    return NextResponse.json({ error: "El responsable es obligatorio (duenoId o duenoEmail)." }, { status: 400 });
  }
  if (duenoId === "invalid") {
    return NextResponse.json({ error: "Responsable no válido (no es miembro de la organización)." }, { status: 400 });
  }

  // mes: explicit value, else the month of fechaLimite (YYYY-MM-DD read literally
  // to avoid UTC/MX shifts), else the current MX month.
  let mes = String(body.mes ?? "").trim();
  if (!mes) {
    mes = /^\d{4}-\d{2}-\d{2}/.test(fechaLimiteRaw) ? fechaLimiteRaw.slice(0, 7) : currentMonthMX();
  }
  if (!MES_RE.test(mes)) {
    return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM." }, { status: 400 });
  }

  const usaChecklist = body.usaChecklist === true;
  const items: string[] = Array.isArray(body.items)
    ? body.items.map((t: unknown) => String(t ?? "").trim()).filter((t: string) => t.length > 0)
    : [];

  // With a checklist the % is derived from items (all start undone → 0).
  let porcentajeAvance = 0;
  if (!usaChecklist && body.porcentajeAvance !== undefined && body.porcentajeAvance !== null && body.porcentajeAvance !== "") {
    const p = Number(body.porcentajeAvance);
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      return NextResponse.json({ error: "El porcentajeAvance debe ser un entero entre 0 y 100." }, { status: 400 });
    }
    porcentajeAvance = p;
  }

  const roca = await db.roca.create({
    data: {
      organizationId,
      titulo,
      metricaExito,
      fechaLimite,
      estatus: rocaColor(new Date(), fechaLimite, porcentajeAvance),
      porcentajeAvance,
      usaChecklist,
      mes,
      duenoId,
      ...(usaChecklist && items.length > 0
        ? { checklist: { create: items.map((t, i) => ({ titulo: t.slice(0, 300), order: i })) } }
        : {}),
    },
    include: ROCA_INCLUDE,
  });

  logActivity({ userId: duenoId, organizationId, action: "roca.create.api", detail: titulo });

  return NextResponse.json({ roca: shape(roca) }, { status: 201 });
}
