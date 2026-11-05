import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/access";
import { currentMonthMX, monthRangeMX, todayMX } from "@/lib/day";
import { ensureMonthStarted } from "@/server/services/month/start";
import {
  getMonthPayments,
  computeNumeroCritico,
  computeCartera,
  computeEmbudo,
  computeVentasPorVendedor,
  computeReportesHoy,
  computeRocas,
} from "@/lib/block-data";

export const dynamic = "force-dynamic";

// GET /api/dashboard/direccion — the six blocks for the current MX month.
export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "dashboard_direccion");
  if (access instanceof NextResponse) return access;
  const { orgId } = access;

  // New month: carries last month's targets over (once) before reading them.
  await ensureMonthStarted(orgId).catch((e) => console.error("month start failed:", e));

  const mes = currentMonthMX();
  const { start, end } = monthRangeMX(mes);
  const hoy = todayMX();

  // Shared: this month's confirmed payments (source of "cobrado").
  const { cobradoTotal, cobradoByCliente, cobradoByVendedor } = await getMonthPayments(
    orgId,
    start,
    end,
  );

  const [numeroCritico, cartera, embudo, ventasPorVendedor, reportesHoy, rocas] =
    await Promise.all([
      computeNumeroCritico(orgId, mes, cobradoTotal),
      computeCartera(orgId, cobradoByCliente, cobradoTotal),
      computeEmbudo(orgId),
      computeVentasPorVendedor(orgId, mes, start, end, cobradoByVendedor),
      computeReportesHoy(orgId, hoy),
      computeRocas(orgId, mes),
    ]);

  return NextResponse.json({
    mes,
    hoy,
    numeroCritico,
    cartera,
    embudo,
    ventasPorVendedor,
    reportesHoy,
    rocas,
  });
}
