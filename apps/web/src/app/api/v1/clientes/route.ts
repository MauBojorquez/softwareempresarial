import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { ClienteEstatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/v1/clientes — list clientes (cartera) with their report day.
// Same API-key auth. Optional ?estatus=ACTIVO|ESPERA|VENCIDO|BAJA filter.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-clientes", limit: 240, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const { organizationId } = auth;

  const estatus = req.nextUrl.searchParams.get("estatus");
  if (estatus && !(Object.values(ClienteEstatus) as string[]).includes(estatus)) {
    return NextResponse.json(
      { error: `Estatus inválido. Usa uno de: ${Object.values(ClienteEstatus).join(", ")}` },
      { status: 400 },
    );
  }

  const rows = await db.cliente.findMany({
    where: {
      organizationId,
      ...(estatus ? { estatus: estatus as ClienteEstatus } : {}),
    },
    orderBy: { nombre: "asc" },
  });

  const clientes = rows.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    contacto: c.contacto,
    estatus: c.estatus,
    salud: c.salud,
    montoMensual: c.montoMensual,
    diaDePago: c.diaDePago,
    diaReporte: c.diaReporte,
    fechaAlta: c.fechaAlta,
  }));

  return NextResponse.json({ count: clientes.length, clientes });
}
