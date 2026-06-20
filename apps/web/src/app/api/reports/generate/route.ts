import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { generateMonthlyReport } from "@/server/services/ai/report-generator";
import { notify } from "@/server/services/push/notify";
import { checkFeatureAccess } from "@/server/services/billing/plan-limits";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

// AI generation can take 20-40s; give the function room so it isn't killed
// mid-flight (which would leave the report stuck as GENERATING).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`report-gen:${ip}`, 5, 60 * 60_000); // 5 per hour
  if (!rl.success) {
    return NextResponse.json({ error: "Límite de generación alcanzado. Espera una hora." }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const access = await checkFeatureAccess(membership.organizationId, "aiReportsPerWeek");
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason, limit: access.limit, current: access.current },
      { status: 403 }
    );
  }

  try {
    const reportId = await generateMonthlyReport(membership.organizationId, session.user.id);

    await notify({
      userId: session.user.id,
      title: "Reporte IA generado",
      message: "Tu reporte mensual con análisis de IA está listo para revisión.",
      type: "report",
      url: "/dashboard/reports",
    });

    logActivity({
      userId: session.user.id,
      organizationId: membership.organizationId,
      action: "report.generate",
    });

    return NextResponse.json({ reportId });
  } catch {
    return NextResponse.json({ error: "Error al generar el reporte. Verifica que tengas datos registrados." }, { status: 500 });
  }
}
