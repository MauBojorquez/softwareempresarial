import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const lead = await db.lead.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (jobRole === "MARKETING" && lead.duenoId !== userId) {
    return NextResponse.json({ error: "Solo puedes ver tus propios leads" }, { status: 403 });
  }

  const notas = await db.leadNota.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
    include: { autor: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    notas: notas.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      createdAt: n.createdAt,
      autorId: n.autorId,
      autorNombre: n.autor?.name ?? n.autor?.email ?? null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "crm");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const lead = await db.lead.findFirst({ where: { id: params.id, organizationId: orgId } });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Marketing may only add notes to their own leads.
  if (jobRole === "MARKETING" && lead.duenoId !== userId) {
    return NextResponse.json({ error: "Solo puedes anotar tus propios leads" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const contenido = (body.contenido ?? "").toString().trim();
  if (!contenido) return NextResponse.json({ error: "La nota no puede estar vacía" }, { status: 400 });

  const nota = await db.leadNota.create({
    data: { leadId: lead.id, contenido, autorId: userId },
    include: { autor: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(
    {
      nota: {
        id: nota.id,
        contenido: nota.contenido,
        createdAt: nota.createdAt,
        autorId: nota.autorId,
        autorNombre: nota.autor?.name ?? nota.autor?.email ?? null,
      },
    },
    { status: 201 },
  );
}
