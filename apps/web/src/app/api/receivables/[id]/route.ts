import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

async function ownRow(orgId: string, id: string) {
  return db.receivable.findFirst({ where: { id, organizationId: orgId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.client !== undefined) data.client = String(body.client).trim();
  if (body.invoiceFolio !== undefined) data.invoiceFolio = body.invoiceFolio ? String(body.invoiceFolio).trim() : null;
  if (body.concept !== undefined) data.concept = body.concept ? String(body.concept).trim() : null;
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    data.amount = Number.isFinite(amount) ? amount : 0;
  }
  if (body.issueDate !== undefined) data.issueDate = new Date(body.issueDate);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;

  if (body.status !== undefined) {
    const status = body.status === "PAGADA" ? "PAGADA" : "ENVIADA";
    data.status = status;
    if (status === "PAGADA") {
      data.paidDate = body.paidDate ? new Date(body.paidDate) : existing.paidDate ?? new Date();
    } else {
      data.paidDate = null;
    }
  } else if (body.paidDate !== undefined) {
    data.paidDate = body.paidDate ? new Date(body.paidDate) : null;
  }

  const updated = await db.receivable.update({ where: { id: params.id }, data });
  return NextResponse.json({ receivable: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAccess(req, "cobranza");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const existing = await ownRow(orgId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.receivable.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
