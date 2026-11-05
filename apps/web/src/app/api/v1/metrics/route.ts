import { NextRequest, NextResponse } from "next/server";
import type { MetricCategory, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { METRIC_CATEGORIES, isMetricCategory } from "@/server/services/metrics/access";

// FINANCE is fed only by SAT / Flujo de Efectivo; manual or API rows are purged
// by GET /api/metrics/manual?category=FINANCE, so they are rejected here.
const WRITABLE_CATEGORIES = METRIC_CATEGORIES.filter((c) => c !== "FINANCE");

/** Validation failure whose message is safe to return to the API client. */
class InputError extends Error {}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-v1", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const apiKey = { organizationId: auth.organizationId };

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (Array.isArray(body)) {
    const results = [];
    for (const item of body.slice(0, 100)) {
      try {
        const metric = await createMetric(apiKey.organizationId, item);
        results.push({ id: metric.id, status: "created" });
      } catch (e) {
        if (!(e instanceof InputError)) console.error("v1 metrics create:", e);
        results.push({ error: e instanceof InputError ? e.message : "Could not create metric", input: item });
      }
    }
    return NextResponse.json({ results, count: results.filter((r) => "id" in r).length });
  }

  try {
    const metric = await createMetric(apiKey.organizationId, body);
    return NextResponse.json({ id: metric.id, status: "created" }, { status: 201 });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("v1 metrics create:", e);
    return NextResponse.json({ error: "Could not create metric" }, { status: 500 });
  }
}

async function createMetric(organizationId: string, data: any) {
  if (!data || typeof data !== "object") throw new InputError("Invalid metric object");
  const { category, name, value, unit, period } = data;

  if (category === "FINANCE") {
    throw new InputError(
      "FINANCE metrics are fed automatically from SAT and Cash Flow; manual/API entries are not allowed.",
    );
  }
  if (!isMetricCategory(category)) {
    throw new InputError(`Invalid category. Must be one of: ${WRITABLE_CATEGORIES.join(", ")}`);
  }
  if (!name || typeof name !== "string" || !name.trim()) throw new InputError("name is required");
  if (typeof value !== "number" || !Number.isFinite(value)) throw new InputError("value must be a number");
  if (unit !== undefined && unit !== null && typeof unit !== "string") throw new InputError("unit must be a string");

  let parsedPeriod = new Date();
  if (period !== undefined && period !== null && period !== "") {
    parsedPeriod = new Date(period);
    if (Number.isNaN(parsedPeriod.getTime())) throw new InputError("period must be a valid date");
  }

  return db.metric.create({
    data: {
      organizationId,
      category,
      name: name.trim().slice(0, 100),
      value,
      unit: unit ? unit.slice(0, 20) : null,
      period: parsedPeriod,
      source: "CUSTOM_API",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-v1", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const apiKey = { organizationId: auth.organizationId };

  const sp = req.nextUrl.searchParams;

  const category = sp.get("category");
  if (category !== null && !isMetricCategory(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${METRIC_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const limitRaw = sp.get("limit");
  let limit = 50;
  if (limitRaw !== null) {
    if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1) {
      return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
    }
    limit = Math.min(Number(limitRaw), 200);
  }

  // Optional period filter: "YYYY-MM" (that UTC month) or "YYYY-MM-DD" (rows
  // with period on or after that date).
  const periodRaw = sp.get("period");
  let periodFilter: Prisma.DateTimeFilter | undefined;
  if (periodRaw !== null) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(periodRaw)) {
      const start = new Date(`${periodRaw}-01T00:00:00.000Z`);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      periodFilter = { gte: start, lt: end };
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(periodRaw) && !Number.isNaN(new Date(`${periodRaw}T00:00:00.000Z`).getTime())) {
      periodFilter = { gte: new Date(`${periodRaw}T00:00:00.000Z`) };
    } else {
      return NextResponse.json({ error: "period must be YYYY-MM or YYYY-MM-DD" }, { status: 400 });
    }
  }

  const where: Prisma.MetricWhereInput = { organizationId: apiKey.organizationId };
  if (category) where.category = category as MetricCategory;
  if (periodFilter) where.period = periodFilter;

  try {
    const metrics = await db.metric.findMany({
      where,
      orderBy: { period: "desc" },
      take: limit,
      select: { id: true, category: true, name: true, value: true, unit: true, period: true, source: true, createdAt: true },
    });
    return NextResponse.json({ metrics, count: metrics.length });
  } catch (e) {
    console.error("v1 metrics list:", e);
    return NextResponse.json({ error: "Could not load metrics" }, { status: 500 });
  }
}
