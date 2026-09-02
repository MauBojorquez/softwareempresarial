import { NextRequest, NextResponse } from "next/server";
import type { JobRole } from "@prisma/client";
import { resolveMember, can } from "@/lib/access";
import { currentMonthMX, monthRangeMX, todayMX } from "@/lib/day";
import { blockById } from "@/lib/blocks";
import {
  getMonthPayments,
  computeNumeroCritico,
  computeCartera,
  computeEmbudo,
  computeVentasPorVendedor,
  computeReportesHoy,
  computeRocas,
  computeTareas,
  computeCobranza,
  computeFlujo,
  computeMarketing,
  type MonthPayments,
} from "@/lib/block-data";

export const dynamic = "force-dynamic";

// GET /api/resumen?blocks=a,b,c — compute the requested blocks the caller's role
// may see (blocks the role can't access are silently omitted, not errored).
export async function GET(req: NextRequest) {
  const access = await resolveMember(req);
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole } = access;

  const requested = (req.nextUrl.searchParams.get("blocks") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const mes = currentMonthMX();
  const { start, end } = monthRangeMX(mes);
  const hoy = todayMX();

  // Only blocks that exist in the registry AND the role may see.
  const allowed = requested
    .map((id) => blockById(id))
    .filter((b): b is NonNullable<typeof b> => !!b && can(jobRole, b.resource));

  const ids = new Set(allowed.map((b) => b.id));

  // Shared payments — computed once if any payment-dependent block is requested.
  let payments: MonthPayments | null = null;
  if (ids.has("numeroCritico") || ids.has("cartera") || ids.has("ventasVendedor")) {
    payments = await getMonthPayments(orgId, start, end);
  }

  const blocks: Record<string, unknown> = {};
  await Promise.all(
    allowed.map(async (b) => {
      switch (b.id) {
        case "numeroCritico":
          blocks.numeroCritico = await computeNumeroCritico(orgId, mes, payments!.cobradoTotal);
          break;
        case "cartera":
          blocks.cartera = await computeCartera(orgId, payments!.cobradoByCliente, payments!.cobradoTotal);
          break;
        case "embudo":
          blocks.embudo = await computeEmbudo(orgId);
          break;
        case "ventasVendedor":
          blocks.ventasVendedor = await computeVentasPorVendedor(
            orgId, mes, start, end, payments!.cobradoByVendedor,
          );
          break;
        case "reportesDia":
          blocks.reportesDia = await computeReportesHoy(orgId, hoy);
          break;
        case "rocas":
          blocks.rocas = await computeRocas(orgId, mes);
          break;
        case "tareas":
          blocks.tareas = await computeTareas(orgId, mes);
          break;
        case "cobranza":
          blocks.cobranza = await computeCobranza(orgId);
          break;
        case "flujo":
          blocks.flujo = await computeFlujo(orgId);
          break;
        case "marketing":
          blocks.marketing = await computeMarketing(orgId, jobRole as JobRole | null);
          break;
      }
    }),
  );

  return NextResponse.json({ blocks });
}
