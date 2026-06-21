import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const cat = await db.cashFlowCategory.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
  });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await db.cashFlowCategory.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.code !== undefined && { code: body.code }),
    },
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const cat = await db.cashFlowCategory.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
  });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.cashFlowCategory.update({ where: { id: params.id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
