import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { shiftMonth } from "@/lib/day";
import { isValidMes } from "../_lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  // Escape hatch: only Dirección may reopen a closed month.
  if (jobRole !== "DIRECCION") {
    return NextResponse.json({ error: "Solo Dirección puede reabrir un mes cerrado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const mes = body.mes;
  if (!isValidMes(mes)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  }

  const existing = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
  if (!existing?.closedThroughMes) {
    return NextResponse.json({ error: "No hay meses cerrados" }, { status: 400 });
  }
  // Reopening a month that is already open would move the frontier forward,
  // i.e. close months — never allowed here.
  if (mes > existing.closedThroughMes) {
    return NextResponse.json(
      { error: `Ese mes no está cerrado (cerrado hasta ${existing.closedThroughMes})` },
      { status: 400 },
    );
  }

  // Reopen `mes` and later → closedThroughMes becomes the month before `mes`.
  const newClosed = shiftMonth(mes, -1);

  const settings = await db.cashFlowSettings.update({
    where: { organizationId: orgId },
    data: { closedThroughMes: newClosed },
  });

  await logActivity({
    userId,
    organizationId: orgId,
    action: "cashflow.reopen",
    detail: `Reabrió el flujo de efectivo desde ${mes} (cerrado hasta ${newClosed})`,
    path: "/dashboard/finance/cashflow",
  });

  return NextResponse.json({ closedThroughMes: settings.closedThroughMes });
}
