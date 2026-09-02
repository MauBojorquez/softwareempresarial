import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";
import { monthRangeMX, currentMonthMX } from "@/lib/day";

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess(req, "flujo");
    if (access instanceof NextResponse) return access;
    const { orgId } = access;
    const account = await db.cashFlowAccount.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const mes = req.nextUrl.searchParams.get("mes") || currentMonthMX();
    const { start, end } = monthRangeMX(mes);

    const [before, monthTx, settings] = await Promise.all([
      // Sum of movements strictly before the month start → carried opening balance
      db.cashFlowTransaction.findMany({
        where: { accountId: params.id, date: { lt: start } },
        select: { deposit: true, withdrawal: true },
      }),
      db.cashFlowTransaction.findMany({
        where: { accountId: params.id, date: { gte: start, lt: end } },
        orderBy: [{ date: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      }),
      db.cashFlowSettings.findUnique({ where: { organizationId: orgId } }),
    ]);

    const saldoInicial =
      account.openingBalance +
      before.reduce((s, t) => s + (t.deposit ?? 0) - (t.withdrawal ?? 0), 0);

    // Running balance for the month, starting from saldoInicial
    let balance = saldoInicial;
    const rows = monthTx.map((t) => {
      balance += (t.deposit ?? 0) - (t.withdrawal ?? 0);
      return { ...t, balance };
    });
    const saldoFinal = balance;

    return NextResponse.json({
      account,
      transactions: rows,
      mes,
      saldoInicial,
      saldoFinal,
      closedThroughMes: settings?.closedThroughMes ?? null,
    });
  } catch (err) {
    console.error("cashflow transactions GET error:", err);
    return NextResponse.json({ transactions: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess(req, "flujo");
    if (access instanceof NextResponse) return access;
    const { orgId } = access;
    const account = await db.cashFlowAccount.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();

    const date = body.date ? new Date(body.date) : new Date();

    // Reject writes into a closed month.
    const settings = await db.cashFlowSettings.findUnique({ where: { organizationId: orgId } });
    if (settings?.closedThroughMes && mesOfDate(date) <= settings.closedThroughMes) {
      return NextResponse.json({ error: "Ese mes está cerrado" }, { status: 403 });
    }

    const count = await db.cashFlowTransaction.count({ where: { accountId: params.id } });
    const tx = await db.cashFlowTransaction.create({
      data: {
        accountId: params.id,
        date,
        bankReference: body.bankReference,
        movementType: body.movementType,
        deposit: body.deposit === "" || body.deposit === null ? null : body.deposit !== undefined ? Number(body.deposit) : null,
        withdrawal: body.withdrawal === "" || body.withdrawal === null ? null : body.withdrawal !== undefined ? Number(body.withdrawal) : null,
        concept: body.concept,
        provider: body.provider,
        reference: body.reference,
        invoiceUuid: body.invoiceUuid,
        taxRate: body.taxRate === "" || body.taxRate === null ? null : body.taxRate !== undefined ? Number(body.taxRate) : null,
        salesType: body.salesType,
        incomeCategories: body.incomeCategories,
        expenseCategories: body.expenseCategories,
        notes: body.notes,
        order: count,
      },
    });
    // Fire-and-forget sync — don't block the response
    syncCashflowMetrics(orgId).catch(console.error);
    return NextResponse.json({ transaction: tx });
  } catch (err) {
    console.error("cashflow transactions POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
