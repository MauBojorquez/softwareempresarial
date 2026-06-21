import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { activeOrgId: true } });
  return user?.activeOrgId ?? null;
}

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accounts = await db.cashFlowAccount.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const count = await db.cashFlowAccount.count({ where: { organizationId: orgId } });
  const account = await db.cashFlowAccount.create({
    data: {
      organizationId: orgId,
      name: body.name,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      openingBalance: body.openingBalance ?? 0,
      order: count,
    },
  });
  // Seed default categories if none exist
  const catCount = await db.cashFlowCategory.count({ where: { organizationId: orgId } });
  if (catCount === 0) {
    const defaults = [
      { code: "CP", name: "Firma Contabilidad", type: "both", order: 0 },
      { code: "CT", name: "Consultoría Tributaria", type: "both", order: 1 },
      { code: "VT", name: "Academia / Ventas", type: "income", order: 2 },
      { code: "CA", name: "Dueño", type: "both", order: 3 },
      { code: "DF", name: "Defensa Fiscal", type: "both", order: 4 },
      { code: "DEP", name: "Departamentos", type: "both", order: 5 },
      { code: "LI", name: "Libros", type: "income", order: 6 },
      { code: "MK", name: "Marketing", type: "both", order: 7 },
      { code: "INV", name: "Fondo de Inversión", type: "expense", order: 8 },
      { code: "IM", name: "Impuestos", type: "expense", order: 9 },
    ];
    await db.cashFlowCategory.createMany({ data: defaults.map(d => ({ ...d, organizationId: orgId })) });
  }
  return NextResponse.json({ account });
}
