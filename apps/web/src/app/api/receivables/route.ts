import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const OVERDUE_DAYS = 30;

/** Effective status for display: an unpaid invoice older than 30 days is overdue. */
function effectiveStatus(status: string, issueDate: Date): "ENVIADA" | "PAGADA" | "VENCIDA" {
  if (status === "PAGADA") return "PAGADA";
  const ageMs = Date.now() - new Date(issueDate).getTime();
  if (ageMs > OVERDUE_DAYS * 24 * 60 * 60 * 1000) return "VENCIDA";
  return "ENVIADA";
}

export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const rows = await db.receivable.findMany({
    where: { organizationId: orgId },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
  });

  const receivables = rows.map((r) => ({
    ...r,
    effectiveStatus: effectiveStatus(r.status, r.issueDate),
  }));

  const totals = receivables.reduce(
    (acc, r) => {
      if (r.effectiveStatus === "PAGADA") {
        acc.cobrado += r.amount;
        acc.pagadas += 1;
      } else {
        acc.porCobrar += r.amount;
        acc.pendientes += 1;
        if (r.effectiveStatus === "VENCIDA") {
          acc.vencido += r.amount;
          acc.vencidas += 1;
        }
      }
      return acc;
    },
    { porCobrar: 0, cobrado: 0, vencido: 0, pagadas: 0, pendientes: 0, vencidas: 0 },
  );

  return NextResponse.json({ receivables, totals });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const body = await req.json().catch(() => ({}));
  const client = (body.client ?? "").toString().trim();
  if (!client) return NextResponse.json({ error: "El cliente es obligatorio" }, { status: 400 });

  const amount = Number(body.amount);
  const status = body.status === "PAGADA" ? "PAGADA" : "ENVIADA";

  const created = await db.receivable.create({
    data: {
      organizationId: orgId,
      client,
      invoiceFolio: body.invoiceFolio ? String(body.invoiceFolio).trim() : null,
      concept: body.concept ? String(body.concept).trim() : null,
      amount: Number.isFinite(amount) ? amount : 0,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      status,
      paidDate: status === "PAGADA" ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
      notes: body.notes ? String(body.notes).trim() : null,
    },
  });

  return NextResponse.json({ receivable: created }, { status: 201 });
}
