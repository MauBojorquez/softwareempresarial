import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sendPushToUser } from "@/server/services/push/send-push";
import { todayMX } from "@/lib/day";
import { SUBMITTER_ROLES } from "@/lib/daily-report";

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

  const fecha = todayMX();
  let reminded = 0;

  const orgs = await db.organization.findMany({ select: { id: true } });

  for (const org of orgs) {
    try {
      // Members whose puesto submits a daily report.
      const members = await db.membership.findMany({
        where: { organizationId: org.id, jobRole: { in: SUBMITTER_ROLES } },
        select: { userId: true },
      });
      if (members.length === 0) continue;

      // Who already submitted today?
      const submitted = await db.dailyReport.findMany({
        where: {
          organizationId: org.id,
          fecha,
          userId: { in: members.map((m) => m.userId) },
        },
        select: { userId: true },
      });
      const done = new Set(submitted.map((r) => r.userId));

      for (const m of members) {
        if (done.has(m.userId)) continue;

        await db.notification.create({
          data: {
            title: "Recordatorio: reporte diario",
            message: "Aún no has enviado tu reporte de hoy.",
            type: "info",
            userId: m.userId,
          },
        });
        await sendPushToUser(m.userId, {
          title: "Recordatorio: reporte diario",
          body: "Aún no has enviado tu reporte de hoy.",
          url: "/dashboard/reportes",
          tag: "daily-report-reminder",
        }).catch(() => {});
        reminded++;
      }
    } catch (e) {
      console.error("daily-report-reminder cron error for org", org.id, e);
    }
  }

  return NextResponse.json({ reminded });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
