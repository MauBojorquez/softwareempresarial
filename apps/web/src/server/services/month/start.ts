import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { currentMonthMX, fechaMX, monthRangeMX, parseFechaMX, shiftMonth } from "@/lib/day";

/**
 * Starts the current month, once per organization per month: every RECURRENTE
 * invoice from last month gets a fresh, unpaid copy dated the same day of this
 * month (unpaid invoices are never deleted; they stay visible as "pendientes
 * de meses anteriores"), last month's sales targets carry over when the new
 * month has none yet, and legacy date-only values are normalized.
 *
 * Runs lazily on the first read of Cobranza or Rocas in the month, so it needs
 * no cron.
 * A client that already has a recurring invoice this month is skipped, so
 * invoices typed by hand before the first read are not duplicated.
 */
export async function ensureMonthStarted(orgId: string): Promise<void> {
  const mes = currentMonthMX();
  const done = await db.cobranzaRollover.findUnique({
    where: { organizationId_mes: { organizationId: orgId, mes } },
  });
  if (done) return;

  try {
    await db.cobranzaRollover.create({ data: { organizationId: orgId, mes } });
  } catch (e) {
    // Another request claimed this month first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }

  try {
    await fixLegacyMidnightDates(orgId);
    await copyRecurring(orgId, mes);
    await carryTargets(orgId, mes);
  } catch (e) {
    // Release the claim so the next read retries instead of skipping the month.
    await db.cobranzaRollover
      .delete({ where: { organizationId_mes: { organizationId: orgId, mes } } })
      .catch(() => {});
    throw e;
  }
}

async function copyRecurring(orgId: string, mes: string) {
  const prev = monthRangeMX(shiftMonth(mes, -1));
  const cur = monthRangeMX(mes);

  const [previous, existing] = await Promise.all([
    db.receivable.findMany({
      where: { organizationId: orgId, tipo: "RECURRENTE", issueDate: { gte: prev.start, lt: prev.end } },
    }),
    db.receivable.findMany({
      where: { organizationId: orgId, tipo: "RECURRENTE", issueDate: { gte: cur.start, lt: cur.end } },
      select: { clienteId: true, clienteManual: true },
    }),
  ]);

  const key = (r: { clienteId: string | null; clienteManual: string | null }) =>
    r.clienteId ?? `manual:${(r.clienteManual ?? "").trim().toLowerCase()}`;
  const taken = new Set(existing.map(key));

  const [y, m] = mes.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const data: Prisma.ReceivableCreateManyInput[] = [];
  for (const r of previous) {
    if (taken.has(key(r))) continue;
    taken.add(key(r));
    const day = Math.min(Number(fechaMX(r.issueDate).slice(8, 10)), daysInMonth);
    data.push({
      organizationId: orgId,
      clienteId: r.clienteId,
      clienteManual: r.clienteManual,
      tipo: r.tipo,
      vendedorId: r.vendedorId,
      concept: r.concept,
      amount: r.amount,
      issueDate: parseFechaMX(`${mes}-${String(day).padStart(2, "0")}`)!,
      pagado: false,
      recurrenteDeId: r.id,
    });
  }
  if (data.length > 0) await db.receivable.createMany({ data, skipDuplicates: true });
}

/** Carries last month's team and per-vendor targets into `mes` (never overwrites). */
async function carryTargets(orgId: string, mes: string) {
  const prev = shiftMonth(mes, -1);
  const [team, vendors] = await Promise.all([
    db.monthlyTarget.findUnique({ where: { organizationId_mes: { organizationId: orgId, mes: prev } } }),
    db.vendorTarget.findMany({ where: { organizationId: orgId, mes: prev } }),
  ]);
  if (team && team.meta > 0) {
    await db.monthlyTarget.createMany({
      data: [{ organizationId: orgId, mes, meta: team.meta }],
      skipDuplicates: true,
    });
  }
  if (vendors.length > 0) {
    await db.vendorTarget.createMany({
      data: vendors.map((v) => ({ organizationId: orgId, mes, userId: v.userId, meta: v.meta })),
      skipDuplicates: true,
    });
  }
}

/**
 * Date-only values saved before dates were stored at Mexico noon were saved at
 * UTC midnight, which reads as 6 pm of the PREVIOUS day in Mexico (an invoice
 * or sale of the 1st landed in last month). Move them to noon of their
 * intended day. Idempotent: rows already at noon don't match. Cash-flow
 * movements are left alone so closed months keep their reconciled balances.
 */
async function fixLegacyMidnightDates(orgId: string) {
  await db.$transaction([
    db.$executeRaw`UPDATE "Receivable" SET "issueDate" = "issueDate" + interval '18 hours'
      WHERE "organizationId" = ${orgId} AND "issueDate"::time = '00:00:00'`,
    db.$executeRaw`UPDATE "Roca" SET "fechaLimite" = "fechaLimite" + interval '18 hours'
      WHERE "organizationId" = ${orgId} AND "fechaLimite"::time = '00:00:00'`,
    db.$executeRaw`UPDATE "Tarea" SET "fechaLimite" = "fechaLimite" + interval '18 hours'
      WHERE "organizationId" = ${orgId} AND "fechaLimite"::time = '00:00:00'`,
    db.$executeRaw`UPDATE "Venta" SET "fechaCierre" = "fechaCierre" + interval '18 hours'
      WHERE "organizationId" = ${orgId} AND "fechaCierre"::time = '00:00:00'`,
    db.$executeRaw`UPDATE "Venta" SET "fechaCobroEsperada" = "fechaCobroEsperada" + interval '18 hours'
      WHERE "organizationId" = ${orgId} AND "fechaCobroEsperada"::time = '00:00:00'`,
  ]);
}
