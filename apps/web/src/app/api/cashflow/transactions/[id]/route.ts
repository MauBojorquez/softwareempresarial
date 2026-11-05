import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";
import { mesMX, parseFechaMX } from "@/lib/day";
import { parseTxNumericFields } from "../../_lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const nums = parseTxNumericFields(body);
  if (!nums.ok) return NextResponse.json({ error: nums.error }, { status: 400 });
  const data: Record<string, unknown> = { ...nums.data };
  let newDate: Date | null = null;
  if (body.date !== undefined) {
    newDate = parseFechaMX(body.date);
    if (!newDate) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    data.date = newDate;
  }
  if (body.bankReference !== undefined) data.bankReference = body.bankReference;
  if (body.movementType !== undefined) data.movementType = body.movementType;
  if (body.concept !== undefined) data.concept = body.concept;
  if (body.provider !== undefined) data.provider = body.provider;
  if (body.reference !== undefined) data.reference = body.reference;
  if (body.invoiceUuid !== undefined) data.invoiceUuid = body.invoiceUuid;
  if (body.salesType !== undefined) data.salesType = body.salesType;
  if (body.notes !== undefined) data.notes = body.notes;

  // Ensure the transaction belongs to an account in this org before updating
  const tx = await db.cashFlowTransaction.findUnique({
    where: { id: params.id },
    include: { account: { select: { organizationId: true } } },
  });
  if (!tx || tx.account.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Transfer rows are paired across two accounts; editing the amount, date or
  // type on one side would desync the pair. Those changes go through delete +
  // re-create instead. Concept/notes stay editable.
  if (
    tx.isTransfer &&
    (body.deposit !== undefined ||
      body.withdrawal !== undefined ||
      body.date !== undefined ||
      body.movementType !== undefined)
  ) {
    return NextResponse.json(
      { error: "Para cambiar una transferencia, bórrala y créala de nuevo." },
      { status: 400 },
    );
  }

  // Reject edits touching a closed month (the transaction's existing month, or
  // — when the date is being changed — its new month).
  const settings = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
  if (settings?.closedThroughMes) {
    if (mesMX(tx.date) <= settings.closedThroughMes) {
      return NextResponse.json({ error: "Ese mes está cerrado" }, { status: 403 });
    }
    if (newDate && mesMX(newDate) <= settings.closedThroughMes) {
      return NextResponse.json({ error: "Ese mes está cerrado" }, { status: 403 });
    }
  }

  const updated = await db.cashFlowTransaction.update({ where: { id: params.id }, data });
  syncCashflowMetrics(orgId).catch(console.error);
  return NextResponse.json({ transaction: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;
  const tx = await db.cashFlowTransaction.findUnique({
    where: { id: params.id },
    include: { account: { select: { organizationId: true } } },
  });
  if (!tx || tx.account.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
  if (settings?.closedThroughMes && mesMX(tx.date) <= settings.closedThroughMes) {
    return NextResponse.json({ error: "Ese mes está cerrado" }, { status: 403 });
  }

  // A transfer deletes both of its linked sides at once.
  if (tx.isTransfer && tx.transferGroupId) {
    await db.cashFlowTransaction.deleteMany({ where: { transferGroupId: tx.transferGroupId } });
  } else {
    await db.cashFlowTransaction.delete({ where: { id: params.id } });
  }
  syncCashflowMetrics(orgId).catch(console.error);
  return NextResponse.json({ ok: true });
}
