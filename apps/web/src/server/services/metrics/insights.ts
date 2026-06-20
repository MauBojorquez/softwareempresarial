import { db } from "@/server/db";
import { metricLabel } from "@/lib/metric-labels";

/**
 * Lightweight, dependency-free analytics over the org's monthly metrics:
 *  - anomaly detection (month-over-month and vs. trailing average)
 *  - simple forecast (linear trend + seasonal-naive blend)
 *
 * Everything runs on the metrics already stored in the DB; no external calls.
 */

export type Severity = "info" | "warning" | "critical";

export interface Anomaly {
  metric: string;
  category: string;
  severity: Severity;
  direction: "up" | "down";
  current: number;
  previous: number;
  changePct: number;
  message: string;
}

export interface ForecastPoint {
  month: string; // "YYYY-MM"
  value: number;
  projected: boolean;
}

export interface ForecastSeries {
  metric: string;
  category: string;
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  trend: "up" | "down" | "flat";
  nextValue: number;
  nextChangePct: number;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** A KPI is "good when it goes up" (revenue) or "good when it goes down" (costs). */
function isCostLike(name: string): boolean {
  const n = norm(name);
  return ["gasto", "egreso", "costo", "compra", "nomina", "deuda", "spend"].some((k) => n.includes(k));
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Groups one metric name into a {monthKey -> summed value} series. */
function buildSeries(
  metrics: { name: string; value: number; period: Date }[],
  name: string,
): Map<string, number> {
  const series = new Map<string, number>();
  for (const m of metrics) {
    if (m.name !== name) continue;
    const k = monthKey(m.period);
    series.set(k, (series.get(k) ?? 0) + m.value);
  }
  return series;
}

/** Ordered list of the last N month keys ending at the current month. */
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}

interface RawMetric { name: string; value: number; period: Date; category: string }

async function loadMetrics(orgId: string): Promise<RawMetric[]> {
  const rows = await db.metric.findMany({
    where: { organizationId: orgId },
    orderBy: { period: "asc" },
    select: { name: true, value: true, period: true, category: true },
  });
  return rows as RawMetric[];
}

/** Distinct metric names that have at least `minPoints` monthly data points. */
function namesWithHistory(metrics: RawMetric[], minPoints: number): { name: string; category: string }[] {
  const counts = new Map<string, { months: Set<string>; category: string }>();
  for (const m of metrics) {
    if (m.name.startsWith("META_")) continue; // skip goal markers
    const entry = counts.get(m.name) ?? { months: new Set<string>(), category: m.category };
    entry.months.add(monthKey(m.period));
    counts.set(m.name, entry);
  }
  return Array.from(counts.entries())
    .filter(([, v]) => v.months.size >= minPoints)
    .map(([name, v]) => ({ name, category: v.category }));
}

export async function detectAnomalies(orgId: string): Promise<Anomaly[]> {
  const metrics = await loadMetrics(orgId);
  const candidates = namesWithHistory(metrics, 2);
  const anomalies: Anomaly[] = [];

  for (const { name, category } of candidates) {
    const series = buildSeries(metrics, name);
    const keys = lastMonths(7).filter((k) => series.has(k));
    if (keys.length < 2) continue;

    const curKey = keys[keys.length - 1];
    const prevKey = keys[keys.length - 2];
    const current = series.get(curKey) ?? 0;
    const ref = series.get(prevKey) ?? 0;
    // Straightforward month-over-month comparison — what an owner understands.
    if (ref === 0 && current === 0) continue;
    if (ref === 0) continue;

    const changePct = ((current - ref) / Math.abs(ref)) * 100;
    const abs = Math.abs(changePct);
    if (abs < 20) continue; // ignore noise

    const direction: "up" | "down" = current >= ref ? "up" : "down";
    const cost = isCostLike(name);
    // "bad" = costs going up, or income/sales going down
    const bad = (cost && direction === "up") || (!cost && direction === "down");

    let severity: Severity = "info";
    if (abs >= 50) severity = bad ? "critical" : "warning";
    else if (abs >= 30) severity = bad ? "warning" : "info";

    // Friendly, plain-language message comparing this month vs the previous one.
    const label = metricLabel(name);
    const arrow = direction === "up" ? "subió" : "bajó";
    const message = `${label} ${arrow} ${abs.toFixed(0)}% frente al mes pasado.`;

    anomalies.push({
      metric: label,
      category,
      severity,
      direction,
      current,
      previous: ref,
      changePct: parseFloat(changePct.toFixed(1)),
      message,
    });
  }

  // Most severe first.
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => order[a.severity] - order[b.severity] || Math.abs(b.changePct) - Math.abs(a.changePct));
  return anomalies;
}

/** Linear regression slope/intercept over indexed points. */
function linreg(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * values[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export async function forecastMetric(
  orgId: string,
  name: string,
  monthsAhead = 3,
): Promise<ForecastSeries | null> {
  const metrics = await loadMetrics(orgId);
  const series = buildSeries(metrics, name);
  if (series.size < 3) return null;

  const keys = lastMonths(12).filter((k) => series.has(k));
  if (keys.length < 3) return null;

  const values = keys.map((k) => series.get(k) ?? 0);
  const { slope, intercept } = linreg(values);

  const category = metrics.find((m) => m.name === name)?.category ?? "FINANCE";
  const history: ForecastPoint[] = keys.map((k, i) => ({ month: k, value: values[i], projected: false }));

  // Seasonal-naive component: same month last year if available.
  const forecast: ForecastPoint[] = [];
  const now = new Date();
  for (let h = 1; h <= monthsAhead; h++) {
    const d = new Date(now.getFullYear(), now.getMonth() + h, 1);
    const k = monthKey(d);
    const trendVal = intercept + slope * (values.length - 1 + h);

    // blend trend with last-year-same-month if we have it
    const lyKey = monthKey(new Date(d.getFullYear() - 1, d.getMonth(), 1));
    const seasonal = series.get(lyKey);
    const blended = seasonal !== undefined ? trendVal * 0.6 + seasonal * 0.4 : trendVal;

    forecast.push({ month: k, value: Math.max(0, Math.round(blended)), projected: true });
  }

  const last = values[values.length - 1];
  const next = forecast[0]?.value ?? last;
  const nextChangePct = last !== 0 ? parseFloat((((next - last) / Math.abs(last)) * 100).toFixed(1)) : 0;
  const trend: "up" | "down" | "flat" = slope > Math.abs(last) * 0.02 ? "up" : slope < -Math.abs(last) * 0.02 ? "down" : "flat";

  return { metric: metricLabel(name), category, history, forecast, trend, nextValue: next, nextChangePct };
}

/** Forecasts the headline money metrics that exist for the org. */
export async function forecastHeadline(orgId: string): Promise<ForecastSeries[]> {
  const metrics = await loadMetrics(orgId);
  const names = namesWithHistory(metrics, 3).map((x) => x.name);

  const preferred = ["Ingresos SAT", "Ingresos", "Ventas", "Egresos SAT", "Gastos", "Pipeline Total"];
  const picked = preferred.filter((p) => names.includes(p)).slice(0, 4);
  const target = picked.length ? picked : names.slice(0, 3);

  const out: ForecastSeries[] = [];
  for (const name of target) {
    const f = await forecastMetric(orgId, name);
    if (f) out.push(f);
  }
  return out;
}
