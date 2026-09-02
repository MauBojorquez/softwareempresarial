import { NextRequest, NextResponse } from "next/server";
import type { JobRole } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { currentMonthMX } from "@/lib/day";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

// Puestos who can own sales (and therefore carry a vendor target).
const VENDEDOR_ROLES: JobRole[] = ["COMERCIAL", "DIRECCION"];

// GET /api/targets?mes=YYYY-MM — the month's Número Crítico meta plus each
// vendedor's sales meta. Gated by "metas".
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "metas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mesParam = req.nextUrl.searchParams.get("mes");
  const mes = mesParam && MES_RE.test(mesParam) ? mesParam : currentMonthMX();

  const monthly = await db.monthlyTarget.findUnique({
    where: { organizationId_mes: { organizationId: orgId, mes } },
  });

  const members = await db.membership.findMany({
    where: { organizationId: orgId, jobRole: { in: VENDEDOR_ROLES } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const vendorTargets = await db.vendorTarget.findMany({
    where: { organizationId: orgId, mes },
  });
  const metaByUser = new Map(vendorTargets.map((v) => [v.userId, v.meta]));

  const vendors = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
    meta: metaByUser.get(m.userId) ?? 0,
  }));

  return NextResponse.json({ mes, monthlyMeta: monthly?.meta ?? 0, vendors });
}

// PUT /api/targets — upsert the monthly Número Crítico meta and/or vendor metas.
// Gated by "metas".
export async function PUT(req: NextRequest) {
  const access = await requireAccess(req, "metas");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));

  let mes = (body.mes ?? "").toString().trim();
  if (!mes) mes = currentMonthMX();
  if (!MES_RE.test(mes)) {
    return NextResponse.json({ error: "El mes debe tener el formato YYYY-MM" }, { status: 400 });
  }

  if (body.monthlyMeta !== undefined && body.monthlyMeta !== null) {
    const meta = Number(body.monthlyMeta);
    if (!Number.isFinite(meta) || meta < 0) {
      return NextResponse.json({ error: "La meta mensual debe ser un número >= 0" }, { status: 400 });
    }
    await db.monthlyTarget.upsert({
      where: { organizationId_mes: { organizationId: orgId, mes } },
      create: { organizationId: orgId, mes, meta },
      update: { meta },
    });
  }

  if (Array.isArray(body.vendors)) {
    for (const v of body.vendors) {
      const userId = (v?.userId ?? "").toString().trim();
      if (!userId) continue;
      const meta = Number(v?.meta);
      if (!Number.isFinite(meta) || meta < 0) {
        return NextResponse.json({ error: "Cada meta de vendedor debe ser un número >= 0" }, { status: 400 });
      }
      const member = await db.membership.findFirst({ where: { userId, organizationId: orgId } });
      if (!member) {
        return NextResponse.json({ error: "Vendedor no válido" }, { status: 400 });
      }
      await db.vendorTarget.upsert({
        where: { organizationId_mes_userId: { organizationId: orgId, mes, userId } },
        create: { organizationId: orgId, mes, userId, meta },
        update: { meta },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
