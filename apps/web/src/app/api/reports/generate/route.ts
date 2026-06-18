import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { generateMonthlyReport } from "@/server/services/ai/report-generator";
import { checkFeatureAccess } from "@/server/services/billing/plan-limits";

export async function POST() {
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

  const access = await checkFeatureAccess(membership.organizationId, "aiReportsPerMonth");
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason, limit: access.limit, current: access.current },
      { status: 403 }
    );
  }

  try {
    const reportId = await generateMonthlyReport(membership.organizationId, session.user.id);

    try {
      await db.notification.create({
        data: {
          userId: session.user.id,
          title: "Reporte IA generado",
          message: "Tu reporte mensual con análisis de IA está listo para revisión.",
          type: "report",
        },
      });
    } catch {}

    return NextResponse.json({ reportId });
  } catch {
    return NextResponse.json({ error: "Error al generar el reporte. Verifica que tengas datos registrados." }, { status: 500 });
  }
}
