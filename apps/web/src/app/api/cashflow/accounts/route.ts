import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const accounts = await db.cashFlowAccount.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { name, bankName, accountNumber, openingBalance } = body;
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });

  const count = await db.cashFlowAccount.count({ where: { organizationId: membership.organizationId } });

  const account = await db.cashFlowAccount.create({
    data: {
      name,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      openingBalance: parseFloat(openingBalance) || 0,
      order: count,
      organizationId: membership.organizationId,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
