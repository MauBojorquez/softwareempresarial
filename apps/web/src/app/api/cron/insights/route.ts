import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { detectAnomalies } from "@/server/services/metrics/insights";
import { sendEmail, digestEmail, fmtMoneyForEmail } from "@/server/services/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const isMonday = now.getDay() === 1;
  const isFirstOfMonth = now.getDate() === 1;
  const force = req.nextUrl.searchParams.get("force") === "1";

  const orgs = await db.organization.findMany({
    select: { id: true, name: true, ownerId: true, owner: { select: { email: true, name: true } } },
  });

  let alerted = 0;
  let digestsSent = 0;

  for (const org of orgs) {
    try {
      const anomalies = await detectAnomalies(org.id);
      const significant = anomalies.filter((a) => a.severity === "critical" || a.severity === "warning");

      // ── In-app notifications (deduped against the last 3 days) ──
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      for (const a of significant.slice(0, 5)) {
        const title = `${a.direction === "up" ? "📈" : "📉"} ${a.metric} ${a.changePct > 0 ? "+" : ""}${a.changePct}%`;
        const existing = await db.notification.findFirst({
          where: { userId: org.ownerId, title, createdAt: { gte: threeDaysAgo } },
        });
        if (existing) continue;
        await db.notification.create({
          data: {
            userId: org.ownerId,
            title,
            message: a.message,
            type: a.severity === "critical" ? "error" : "warning",
          },
        });
        alerted++;
      }

      // ── Scheduled digest email ──
      const sendDigest = force || isMonday || isFirstOfMonth;
      if (sendDigest && org.owner?.email) {
        const metrics = await db.metric.findMany({
          where: { organizationId: org.id },
          orderBy: { period: "desc" },
          take: 200,
        });
        if (metrics.length > 0) {
          const cm = now.getMonth();
          const cy = now.getFullYear();
          const monthSum = (kw: string[], cat?: string) =>
            metrics
              .filter((m) => m.period.getMonth() === cm && m.period.getFullYear() === cy)
              .filter((m) => !cat || m.category === cat)
              .filter((m) => kw.some((k) => m.name.toLowerCase().includes(k)))
              .reduce((s, m) => s + m.value, 0);

          const ingresos = monthSum(["ingreso", "venta", "facturado"]);
          const egresos = monthSum(["egreso", "gasto", "costo", "compra"]);
          const kpis = [
            { label: "Ingresos del mes", value: fmtMoneyForEmail(ingresos) },
            { label: "Egresos del mes", value: fmtMoneyForEmail(egresos) },
            { label: "Balance", value: fmtMoneyForEmail(ingresos - egresos) },
          ];
          const period = isFirstOfMonth && !isMonday ? "mensual" : "semanal";
          const { subject, html } = digestEmail(
            org.owner.name ?? "empresario",
            org.name,
            period as "semanal" | "mensual",
            kpis,
            significant.slice(0, 5).map((a) => ({ message: a.message, severity: a.severity })),
          );
          await sendEmail(org.owner.email, subject, html);
          digestsSent++;
        }
      }
    } catch (e) {
      console.error("insights cron error for org", org.id, e);
    }
  }

  return NextResponse.json({ ok: true, alerted, digestsSent, orgs: orgs.length });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
