import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { detectAnomalies } from "@/server/services/metrics/insights";
import { sendEmail, digestEmail, fmtMoneyForEmail } from "@/server/services/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
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

  // ── User-defined alert rules evaluation ──
  let rulesFired = 0;
  try {
    const activeRules = await db.alertRule.findMany({
      where: { isActive: true },
      include: {
        organization: {
          select: { id: true, name: true, owner: { select: { email: true, name: true } } },
        },
      },
    });

    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const rule of activeRules) {
      try {
        // Skip if triggered in the last 24h
        if (rule.lastTriggered && rule.lastTriggered > twentyFourHoursAgo) continue;

        const orgId = rule.organizationId;

        // Get the two most recent metric values matching the rule's metricName for the org
        const recentMetrics = await db.metric.findMany({
          where: {
            organizationId: orgId,
            name: { contains: rule.metricName, mode: "insensitive" },
          },
          orderBy: { period: "desc" },
          take: 2,
        });

        if (recentMetrics.length === 0) continue;

        const latestValue = recentMetrics[0].value;
        const previousValue = recentMetrics[1]?.value ?? null;

        let triggered = false;
        let triggerDetail = "";

        if (rule.condition === "below") {
          triggered = latestValue < rule.threshold;
          triggerDetail = `el valor actual (${latestValue.toLocaleString("es-MX")}) está por debajo del umbral (${rule.threshold.toLocaleString("es-MX")})`;
        } else if (rule.condition === "above") {
          triggered = latestValue > rule.threshold;
          triggerDetail = `el valor actual (${latestValue.toLocaleString("es-MX")}) superó el umbral (${rule.threshold.toLocaleString("es-MX")})`;
        } else if (rule.condition === "change_pct_down" && previousValue !== null && previousValue !== 0) {
          const changePct = ((previousValue - latestValue) / Math.abs(previousValue)) * 100;
          triggered = changePct > rule.threshold;
          triggerDetail = `la métrica cayó un ${changePct.toFixed(1)}% (umbral: ${rule.threshold}%)`;
        } else if (rule.condition === "change_pct_up" && previousValue !== null && previousValue !== 0) {
          const changePct = ((latestValue - previousValue) / Math.abs(previousValue)) * 100;
          triggered = changePct > rule.threshold;
          triggerDetail = `la métrica subió un ${changePct.toFixed(1)}% (umbral: ${rule.threshold}%)`;
        }

        if (!triggered) continue;

        // Send alert email to org owner
        const ownerEmail = rule.organization.owner?.email;
        if (ownerEmail) {
          const subject = `⚠️ Alerta StratiuMetrics: ${rule.metricName}`;
          const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">StratiuMetrics</h1>
<p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Dashboard Empresarial Inteligente</p>
</td></tr>
<tr><td style="padding:32px;">
<h2 style="margin:0 0 8px;color:#18181b;font-size:20px;">⚠️ Alerta activada</h2>
<p style="color:#71717a;font-size:15px;line-height:1.6;">Hola, tu alerta para <strong>${rule.metricName}</strong> en <strong>${rule.organization.name}</strong> fue activada.</p>
<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:20px;margin:20px 0;">
  <p style="margin:0;color:#92400e;font-size:14px;line-height:1.7;"><strong>Motivo:</strong> ${triggerDetail}.</p>
</div>
<p style="color:#71717a;font-size:13px;">Métrica: <strong>${rule.metricName}</strong> · Categoría: ${rule.category}</p>
<a href="${process.env.NEXTAUTH_URL}/dashboard/overview" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Ver Dashboard</a>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #f4f4f5;text-align:center;">
<p style="margin:0;font-size:12px;color:#a1a1aa;">© 2026 StratiuMetrics · Todos los derechos reservados</p>
</td></tr>
</table></td></tr></table></body></html>`;
          await sendEmail(ownerEmail, subject, html);
        }

        // Update lastTriggered
        await db.alertRule.update({
          where: { id: rule.id },
          data: { lastTriggered: now },
        });
        rulesFired++;
      } catch (e) {
        console.error("alert rule evaluation error for rule", rule.id, e);
      }
    }
  } catch (e) {
    console.error("alert rules cron error", e);
  }

  return NextResponse.json({ ok: true, alerted, digestsSent, rulesFired, orgs: orgs.length });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
