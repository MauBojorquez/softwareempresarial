import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { activeOrgId: true } });
  return user?.activeOrgId ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  await db.cashFlowAccount.updateMany({
    where: { id: params.id, organizationId: orgId },
    data: { name: body.name, bankName: body.bankName, openingBalance: body.openingBalance, order: body.order },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.cashFlowAccount.updateMany({ where: { id: params.id, organizationId: orgId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
