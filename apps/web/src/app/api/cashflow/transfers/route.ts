import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";
import { mesMX, parseFechaMX } from "@/lib/day";

export const dynamic = "force-dynamic";

// POST /api/cashflow/transfers — move money between two accounts.
// Creates two linked rows (withdrawal in origin, deposit in destination),
// both flagged isTransfer so they never count as income/expense in the flow,
// only shift each account's balance. Body: { fromAccountId, toAccountId,
// amount, date?, concept? }.
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const fromAccountId = String(body.fromAccountId ?? "");
  const toAccountId = String(body.toAccountId ?? "");
  // Number("") / Number(null) are 0 and Number(true) is 1 — only accept real
  // numbers or numeric strings.
  const amount =
    typeof body.amount === "number" || (typeof body.amount === "string" && body.amount.trim())
      ? Number(body.amount)
      : NaN;
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

  // No date → now; a date that was sent must parse as an MX calendar day.
  const date = body.date === undefined ? new Date() : parseFechaMX(body.date);
  if (!date) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  // Reject transfers landing in a closed month.
  const settings = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
  if (settings?.closedThroughMes && mesMX(date) <= settings.closedThroughMes) {
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
