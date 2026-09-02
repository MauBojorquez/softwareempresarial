import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { monthRangeMX, currentMonthMX } from "@/lib/day";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtNum(n: number): string {
  return n.toFixed(2);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function slug(s: string): string {
  return (s || "cuenta")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cuenta";
}

export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "flujo");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  const mes = req.nextUrl.searchParams.get("mes") || currentMonthMX();
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId requerido" }, { status: 400 });
  }

  const account = await db.cashFlowAccount.findFirst({ where: { id: accountId, organizationId: orgId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { start, end } = monthRangeMX(mes);

  const [before, monthTx] = await Promise.all([
    db.cashFlowTransaction.findMany({
      where: { accountId, date: { lt: start } },
      select: { deposit: true, withdrawal: true },
    }),
    db.cashFlowTransaction.findMany({
      where: { accountId, date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const saldoInicial =
    account.openingBalance +
    before.reduce((s, t) => s + (t.deposit ?? 0) - (t.withdrawal ?? 0), 0);

  const lines: string[] = [];
  lines.push([csvCell(`Flujo de efectivo — ${account.name}`), csvCell(mes)].join(","));
  lines.push([csvCell("Saldo inicial"), "", "", "", "", csvCell(fmtNum(saldoInicial))].join(","));
  lines.push(["Fecha", "Concepto", "Proveedor/Referencia", "Depósito", "Retiro", "Saldo"].join(","));

  let balance = saldoInicial;
  for (const t of monthTx) {
    balance += (t.deposit ?? 0) - (t.withdrawal ?? 0);
    const provRef = [t.provider, t.reference].filter(Boolean).join(" / ");
    lines.push(
      [
        csvCell(fmtDate(t.date)),
        csvCell(t.concept ?? ""),
        csvCell(provRef),
        csvCell(t.deposit != null ? fmtNum(t.deposit) : ""),
        csvCell(t.withdrawal != null ? fmtNum(t.withdrawal) : ""),
        csvCell(fmtNum(balance)),
      ].join(","),
    );
  }

  lines.push([csvCell("Saldo final"), "", "", "", "", csvCell(fmtNum(balance))].join(","));

  // Prepend BOM so Excel reads UTF-8 accents correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const filename = `flujo-${slug(account.name)}-${mes}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
