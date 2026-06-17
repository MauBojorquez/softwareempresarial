import { db } from "@/server/db";
import type { MetricCategory } from "@prisma/client";

export async function getLatestMetrics(organizationId: string, category?: MetricCategory) {
  const where: Record<string, unknown> = { organizationId };
  if (category) where.category = category;

  const metrics = await db.metric.findMany({
    where,
    orderBy: { period: "desc" },
    take: 50,
  });

  return metrics;
}

export async function getMetricsByName(organizationId: string, names: string[]) {
  const metrics = await db.metric.findMany({
    where: {
      organizationId,
      name: { in: names },
    },
    orderBy: { period: "desc" },
  });

  const latest: Record<string, { value: number; previous?: number; period: Date }> = {};

  for (const m of metrics) {
    if (!latest[m.name]) {
      latest[m.name] = { value: m.value, period: m.period };
    } else if (!latest[m.name].previous) {
      latest[m.name].previous = m.value;
    }
  }

  return latest;
}

export async function getMetricHistory(
  organizationId: string,
  name: string,
  months = 6
) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  return db.metric.findMany({
    where: {
      organizationId,
      name,
      period: { gte: since },
    },
    orderBy: { period: "asc" },
    select: { value: true, period: true },
  });
}

export function calculateChange(current: number, previous?: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}
