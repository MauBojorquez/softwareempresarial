import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { isValidDate } from "@/lib/day";
import { runConsolidado } from "@/server/services/automations/consolidado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/v1/automations/consolidado — sends the director's morning digest of
// the team's daily reports (previous business day; Monday covers Fri–Sun).
// Called by Make on a schedule (L–V 8:00 MX). Same API-key auth as v1.
//   ?dryRun=1        → builds it and returns { subject, html } without sending.
//   ?hoy=YYYY-MM-DD  → treat that date as "today" (for testing past days).
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-automations", limit: 30, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const hoy = sp.get("hoy");
  if (hoy && !isValidDate(hoy)) {
    return NextResponse.json({ error: "El parámetro 'hoy' debe tener el formato YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const result = await runConsolidado(auth.organizationId, {
      today: hoy ?? undefined,
      dryRun: sp.get("dryRun") === "1",
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[consolidado] error:", e);
    return NextResponse.json({ error: "No se pudo generar el consolidado." }, { status: 500 });
  }
}
