import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId, userId } = access;

  const body = await req.json().catch(() => ({}));
  const mes = typeof body.mes === "string" ? body.mes : "";
  if (!MES_RE.test(mes)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  }

  const existing = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
  // Only allow moving the closed frontier FORWARD (equal is idempotent).
  if (existing?.closedThroughMes && mes < existing.closedThroughMes) {
    return NextResponse.json(
      { error: `El flujo ya está cerrado hasta ${existing.closedThroughMes}; no se puede cerrar un mes anterior.` },
      { status: 400 },
    );
  }

  const settings = await db.cashFlowSettings.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, closedThroughMes: mes },
    update: { closedThroughMes: mes },
  });

  await logActivity({
    userId,
    organizationId: orgId,
    action: "cashflow.close",
    detail: `Cerró el flujo de efectivo hasta ${mes}`,
    path: "/dashboard/finance/cashflow",
  });

  return NextResponse.json({ closedThroughMes: settings.closedThroughMes });
}
