import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { isValidDate } from "@/lib/day";
import { NotMemberError, runPendientes } from "@/server/services/automations/pendientes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/v1/automations/pendientes?userId=<id> — builds and emails ONE
// collaborator's morning pendientes (only to them). Make calls it L–V at 9:50
// MX once per person (ids from GET /api/v1/team), so each run fits in 60s.
//   ?dryRun=1        → does not send (preview HTML only if Google isn't connected).
//   ?hoy=YYYY-MM-DD  → treat that date as "today".
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { bucket: "api-automations", limit: 30, windowMs: 60_000 });
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const userId = (sp.get("userId") ?? "").trim();
  if (!userId) return NextResponse.json({ error: "El parámetro 'userId' es obligatorio." }, { status: 400 });
  const hoy = sp.get("hoy");
  if (hoy && !isValidDate(hoy)) {
    return NextResponse.json({ error: "El parámetro 'hoy' debe tener el formato YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const result = await runPendientes(auth.organizationId, userId, {
      today: hoy ?? undefined,
      dryRun: sp.get("dryRun") === "1",
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NotMemberError) {
      return NextResponse.json({ error: "Usuario no encontrado en la organización." }, { status: 404 });
    }
    console.error("[pendientes] error:", e);
    return NextResponse.json({ error: "No se pudieron generar los pendientes." }, { status: 500 });
  }
}
