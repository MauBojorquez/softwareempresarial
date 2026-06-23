import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { logActivity } from "@/lib/activity";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const months = Math.min(Math.max(parseInt(searchParams.get("months") || "1", 10), 1), 24);

  const validCategories = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }

  // The Finanzas page reads FINANCE rows here. Reconcile cashflow first so the
  // cards (Ingresos / Gastos / computed Flujo de Caja) always match the Flujo
  // de Efectivo module, even on a direct visit without editing a transaction.
  if (category === "FINANCE") {
    await syncCashflowMetrics(membership.organizationId).catch((e) =>
      console.error("cashflow reconcile (finance):", e),
    );
    // Finanzas is SAT-only. Purge any legacy MANUAL rows (source is null /
    // anything other than "SAT") so old hand-entered numbers stop polluting
    // the cards. Self-cleans on the next visit; idempotent once gone.
    await db.metric
      .deleteMany({
        where: {
          organizationId: membership.organizationId,
          category: "FINANCE",
          OR: [{ source: null }, { source: { not: "SAT" } }],
        },
      })
      .catch((e) => console.error("finance manual purge:", e));
  }

  // Anchor to the first day of the month `months` months ago so the
  // filter is month-aligned (e.g. "3 months" = this month + last 2 months).
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const metrics = await db.metric.findMany({
    where: {
      organizationId: membership.organizationId,
      category: category as any,
      period: { gte: since },
    },
    orderBy: { period: "desc" },
  });

  return NextResponse.json({ metrics });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host.split(":")[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { category, name, value, unit, period } = body;

  const validCategories = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];
  if (!category || !validCategories.includes(category) || !name || value === undefined) {
    return NextResponse.json({ error: "Valid category, name, and value are required" }, { status: 400 });
  }

  // Finanzas se alimenta solo del SAT y del módulo de Flujo de Efectivo.
  // No se permiten registros manuales en esta categoría.
  if (category === "FINANCE") {
    return NextResponse.json(
      { error: "Finanzas se alimenta automáticamente del SAT y del Flujo de Efectivo. No se permiten registros manuales." },
      { status: 400 },
    );
  }

  if (typeof name !== "string" || name.length > 100) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue) || !isFinite(numValue)) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const metric = await db.metric.create({
    data: {
      category,
      name,
      value: numValue,
      unit: unit || null,
      period: period ? new Date(period) : new Date(),
      source: null,
      organizationId: membership.organizationId,
    },
  });

  logActivity({
    userId: session.user.id,
    organizationId: membership.organizationId,
    action: "metric.create",
    detail: `${name} (${category})`,
  });

  return NextResponse.json({ metric }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const body = await req.json();
  const { id, value, period } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const metric = await db.metric.findFirst({ where: { id, organizationId: membership.organizationId } });
  if (!metric) return NextResponse.json({ error: "Metric not found" }, { status: 404 });

  // Validate inputs before persisting
  let parsedValue: number | undefined;
  if (value !== undefined) {
    parsedValue = parseFloat(value);
    if (!Number.isFinite(parsedValue)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
  }

  let parsedPeriod: Date | undefined;
  if (period !== undefined) {
    parsedPeriod = new Date(period);
    if (isNaN(parsedPeriod.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
  }

  const updated = await db.metric.update({
    where: { id },
    data: {
      ...(parsedValue !== undefined && { value: parsedValue }),
      ...(parsedPeriod !== undefined && { period: parsedPeriod }),
    },
  });

  return NextResponse.json({ success: true, metric: updated });
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host.split(":")[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const metric = await db.metric.findFirst({
    where: { id, organizationId: membership.organizationId },
  });

  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  await db.metric.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
