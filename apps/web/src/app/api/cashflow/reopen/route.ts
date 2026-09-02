import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

/** Month string "YYYY-MM" immediately before the given one. */
function prevMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m-2 = previous month (0-based)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  // Escape hatch: only Dirección may reopen a closed month.
  if (jobRole !== "DIRECCION") {
    return NextResponse.json({ error: "Solo Dirección puede reabrir un mes cerrado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mes = typeof body.mes === "string" ? body.mes : "";
  if (!MES_RE.test(mes)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  }

  // Reopen `mes` and later → closedThroughMes becomes the month before `mes`.
  const newClosed = prevMes(mes);

  const settings = await db.cashFlowSettings.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, closedThroughMes: newClosed },
    update: { closedThroughMes: newClosed },
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
