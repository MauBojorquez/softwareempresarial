import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "@/lib/api-key-auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-v1", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const apiKey = { organizationId: auth.organizationId };

  const body = await req.json();

  if (Array.isArray(body)) {
    const results = [];
    for (const item of body.slice(0, 100)) {
      try {
        const metric = await createMetric(apiKey.organizationId, item);
        results.push({ id: metric.id, status: "created" });
      } catch (e: any) {
        results.push({ error: e.message, input: item });
      }
    }
    return NextResponse.json({ results, count: results.filter((r) => "id" in r).length });
  }

  try {
    const metric = await createMetric(apiKey.organizationId, body);
    return NextResponse.json({ id: metric.id, status: "created" }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

async function createMetric(organizationId: string, data: any) {
  const { category, name, value, unit, period } = data;

  const validCategories = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(", ")}`);
  }
  if (!name || typeof name !== "string") throw new Error("name is required");
  if (typeof value !== "number") throw new Error("value must be a number");

  return db.metric.create({
    data: {
      organizationId,
      category,
      name: name.trim().slice(0, 100),
      value,
      unit: unit || null,
      period: period ? new Date(period) : new Date(),
      source: "CUSTOM_API",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-v1", limit: 120, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;
  const apiKey = { organizationId: auth.organizationId };

  const category = req.nextUrl.searchParams.get("category");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 200);

  const where: any = { organizationId: apiKey.organizationId };
  if (category) where.category = category;

  const metrics = await db.metric.findMany({
    where,
    orderBy: { period: "desc" },
    take: limit,
    select: { id: true, category: true, name: true, value: true, unit: true, period: true, source: true, createdAt: true },
  });

  return NextResponse.json({ metrics, count: metrics.length });
}
