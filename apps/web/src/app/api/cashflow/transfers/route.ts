import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";

export const dynamic = "force-dynamic";

/** "YYYY-MM" (MX month) that a given date falls into. */
function mesOfDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}

// POST /api/cashflow/transfers — move money between two accounts.
// Creates two linked rows (withdrawal in origin, deposit in destination),
// both flagged isTransfer so they never count as income/expense in the flow,
// only shift each account's balance. Body: { fromAccountId, toAccountId,
// amount, date?, concept? }.
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));
  const fromAccountId = String(body.fromAccountId ?? "");
  const toAccountId = String(body.toAccountId ?? "");
  const amount = Number(body.amount);
  const concept = body.concept ? String(body.concept).trim() : null;

  if (!fromAccountId || !toAccountId) {
    return NextResponse.json({ error: "Selecciona la cuenta origen y destino" }, { status: 400 });
  }
  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: "La cuenta origen y destino deben ser distintas" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    db.cashFlowAccount.findFirst({ where: { id: fromAccountId, organizationId: orgId } }),
    db.cashFlowAccount.findFirst({ where: { id: toAccountId, organizationId: orgId } }),
  ]);
  if (!from || !to) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  // Reject transfers landing in a closed month.
  const settings = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
  if (settings?.closedThroughMes && mesOfDate(date) <= settings.closedThroughMes) {
    return NextResponse.json({ error: "Ese mes está cerrado" }, { status: 403 });
  }

  const transferGroupId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const [fromCount, toCount] = await Promise.all([
    db.cashFlowTransaction.count({ where: { accountId: fromAccountId } }),
    db.cashFlowTransaction.count({ where: { accountId: toAccountId } }),
  ]);

  await db.$transaction([
    db.cashFlowTransaction.create({
      data: {
        accountId: fromAccountId,
        date,
        movementType: `Transferencia → ${to.name}`,
        withdrawal: amount,
        concept,
        isTransfer: true,
        transferGroupId,
        order: fromCount,
      },
    }),
    db.cashFlowTransaction.create({
      data: {
        accountId: toAccountId,
        date,
        movementType: `Transferencia ← ${from.name}`,
        deposit: amount,
        concept,
        isTransfer: true,
        transferGroupId,
        order: toCount,
      },
    }),
  ]);

  syncCashflowMetrics(orgId).catch(console.error);

  return NextResponse.json({ ok: true, transferGroupId }, { status: 201 });
}
