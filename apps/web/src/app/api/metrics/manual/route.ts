import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { logActivity } from "@/lib/activity";
import { syncCashflowMetrics } from "@/lib/cashflow-sync";
import { can, requireAccess, resolveMember } from "@/lib/access";
import { currentMonthMX, parseFechaMX, shiftMonth, todayMX } from "@/lib/day";
import { FINANCE_MANUAL_ERROR, isMetricCategory, metricResource } from "@/server/services/metrics/access";

const FORBIDDEN = "No tienes acceso a esta sección";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const monthsRaw = parseInt(searchParams.get("months") || "1", 10);
  const months = Number.isFinite(monthsRaw) ? Math.min(Math.max(monthsRaw, 1), 24) : 1;

  if (!isMetricCategory(category)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }

  const access = await requireAccess(req, metricResource(category));
  if (access instanceof NextResponse) return access;
  const membership = { organizationId: access.orgId };

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
  // The current month is the business (MX) month; metric rows are bucketed by
  // their UTC month string (manual rows are stored at UTC-midnight day 1), so
  // the window starts at UTC midnight of that month's day 1.
  const sinceMonth = shiftMonth(currentMonthMX(), -(months - 1));
  const since = new Date(`${sinceMonth}-01T00:00:00.000Z`);

  const metrics = await db.metric.findMany({
    where: {
      organizationId: membership.organizationId,
      category,
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const { category, name, value, unit, period } = body;

  if (!isMetricCategory(category) || !name || value === undefined) {
    return NextResponse.json({ error: "Valid category, name, and value are required" }, { status: 400 });
  }

  // Finanzas se alimenta solo del SAT y del módulo de Flujo de Efectivo.
  // No se permiten registros manuales en esta categoría.
  if (category === "FINANCE") {
    return NextResponse.json({ error: FINANCE_MANUAL_ERROR }, { status: 400 });
  }

  const access = await requireAccess(req, metricResource(category));
  if (access instanceof NextResponse) return access;
  const membership = { organizationId: access.orgId };
  const session = { user: { id: access.userId } };

  if (typeof name !== "string" || name.length > 100) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue) || !isFinite(numValue)) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  // A bare "YYYY-MM-DD" is a Mexico calendar day (stored at local noon); the
  // default is today in Mexico, so late-evening entries don't land next month.
  const parsedPeriod = period ? parseFechaMX(period) : parseFechaMX(todayMX());
  if (!parsedPeriod) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const metric = await db.metric.create({
    data: {
      category,
      name,
      value: numValue,
      unit: typeof unit === "string" && unit ? unit.slice(0, 20) : null,
      period: parsedPeriod,
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
  const member = await resolveMember(req);
  if (member instanceof NextResponse) return member;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const { id, value, period } = body ?? {};
  if (!id || typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

  const metric = await db.metric.findFirst({ where: { id, organizationId: member.orgId } });
  if (!metric) return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  if (!can(member.jobRole, metricResource(metric.category))) {
    return NextResponse.json({ error: FORBIDDEN }, { status: 403 });
  }

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
    parsedPeriod = parseFechaMX(period) ?? undefined;
    if (!parsedPeriod) {
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

  const member = await resolveMember(req);
  if (member instanceof NextResponse) return member;
  const membership = { organizationId: member.orgId };

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
  if (!can(member.jobRole, metricResource(metric.category))) {
    return NextResponse.json({ error: FORBIDDEN }, { status: 403 });
  }

  await db.metric.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
