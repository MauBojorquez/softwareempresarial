import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { can, resolveMember } from "@/lib/access";

export const dynamic = "force-dynamic";

type Result = { type: "cliente" | "lead" | "tarea" | "roca"; id: string; title: string; subtitle: string; href: string };

// GET /api/search?q= — global search over the things the team actually works
// with (clientes, leads, tareas, rocas). Each source is only searched when the
// caller's puesto may read it (same RBAC matrix as the pages).
export async function GET(req: NextRequest) {
  const member = await resolveMember(req);
  if (member instanceof NextResponse) return member;
  const { orgId, jobRole, userId } = member;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const has = { contains: q, mode: "insensitive" as const };

  const [clientes, leads, tareas, rocas] = await Promise.all([
    can(jobRole, "cartera")
      ? db.cliente.findMany({
          where: { organizationId: orgId, OR: [{ nombre: has }, { contacto: has }] },
          take: 5,
          select: { id: true, nombre: true, estatus: true },
        })
      : [],
    can(jobRole, "crm")
      ? db.lead.findMany({
          where: {
            organizationId: orgId,
            ...(jobRole === "MARKETING" ? { duenoId: userId } : {}),
            OR: [{ nombre: has }, { empresa: has }, { email: has }, { telefono: has }],
          },
          take: 5,
          orderBy: { fechaUltimoMovimiento: "desc" },
          select: { id: true, nombre: true, empresa: true, etapa: true },
        })
      : [],
    can(jobRole, "tareas")
      ? db.tarea.findMany({
          where: { organizationId: orgId, descripcion: has },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, descripcion: true, estatus: true, cliente: { select: { nombre: true } } },
        })
      : [],
    can(jobRole, "rocas")
      ? db.roca.findMany({
          where: { organizationId: orgId, titulo: has },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, titulo: true, mes: true, porcentajeAvance: true },
        })
      : [],
  ]);

  const results: Result[] = [
    ...clientes.map((c) => ({ type: "cliente" as const, id: c.id, title: c.nombre, subtitle: `Cliente · ${c.estatus.toLowerCase()}`, href: "/dashboard/finance/cartera" })),
    ...leads.map((l) => ({ type: "lead" as const, id: l.id, title: l.nombre, subtitle: `Lead${l.empresa ? ` · ${l.empresa}` : ""}`, href: "/dashboard/crm" })),
    ...tareas.map((t) => ({ type: "tarea" as const, id: t.id, title: t.descripcion, subtitle: `Tarea · ${t.cliente.nombre} · ${t.estatus === "COMPLETADA" ? "completada" : "pendiente"}`, href: "/dashboard/finance/tareas" })),
    ...rocas.map((r) => ({ type: "roca" as const, id: r.id, title: r.titulo, subtitle: `Roca · ${r.mes} · ${r.porcentajeAvance}%`, href: "/dashboard/rocas" })),
  ];

  return NextResponse.json({ results });
}
