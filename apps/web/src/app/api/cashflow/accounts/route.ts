import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getOrganizationId } from "@/lib/get-org";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrganizationId(req);
    if (!orgId) return NextResponse.json({ accounts: [] });
    const accounts = await db.cashFlowAccount.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("cashflow/accounts GET error:", err);
    return NextResponse.json({ accounts: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrganizationId(req);
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 401 });
    const body = await req.json();
    if (!body?.name || !String(body.name).trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const count = await db.cashFlowAccount.count({ where: { organizationId: orgId } });
    const account = await db.cashFlowAccount.create({
      data: {
        organizationId: orgId,
        name: String(body.name).trim(),
        bankName: body.bankName ?? null,
        accountNumber: body.accountNumber ?? null,
        openingBalance: Number(body.openingBalance) || 0,
        order: count,
      },
    });
    // Seed default categories the first time any account is created
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
      await db.cashFlowCategory.createMany({
        data: defaults.map((d) => ({ ...d, organizationId: orgId })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json({ account });
  } catch (err) {
    console.error("cashflow/accounts POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
