import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  await db.cashFlowCategory.updateMany({
    where: { id: params.id, organizationId: orgId },
    data: { name: body.name, type: body.type },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.cashFlowCategory.updateMany({ where: { id: params.id, organizationId: orgId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
