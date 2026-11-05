import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { parseFechaMX } from "@/lib/day";
import { FINANCE_MANUAL_ERROR, isMetricCategory, metricResource } from "@/server/services/metrics/access";

const UNIT_MAP: Record<string, string> = {
  MXN: "MXN", pesos: "MXN", unidades: "unidades", personas: "personas",
  porcentaje: "%", "%": "%", días: "días", pts: "pts",
};

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const fileEntry = formData.get("file");
  const file = fileEntry && typeof fileEntry !== "string" ? fileEntry : null;
  const category = formData.get("category");

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!isMetricCategory(category) || category === "MARKETING") return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  // Finanzas se alimenta solo del SAT y del Flujo de Efectivo (and GET
  // /api/metrics/manual?category=FINANCE purges non-SAT rows anyway).
  if (category === "FINANCE") return NextResponse.json({ error: FINANCE_MANUAL_ERROR }, { status: 400 });

  const access = await requireAccess(req, metricResource(category));
  if (access instanceof NextResponse) return access;
  const membership = { organizationId: access.orgId };
  const session = { user: { id: access.userId } };

  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "El archivo no puede superar 2 MB" }, { status: 400 });

  const text = await file.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const MAX_ROWS = 5000;
  if (lines.length - 1 > MAX_ROWS) {
    return NextResponse.json({ error: `El archivo no puede tener más de ${MAX_ROWS} filas` }, { status: 400 });
  }

  if (lines.length < 2) return NextResponse.json({ error: "File must have header + at least one row" }, { status: 400 });

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const fechaIdx = header.indexOf("fecha");
  const metricaIdx = header.indexOf("metrica");
  const valorIdx = header.indexOf("valor");
  const unidadIdx = header.indexOf("unidad");

  if (fechaIdx === -1 || metricaIdx === -1 || valorIdx === -1) {
    return NextResponse.json({ error: "CSV must have columns: fecha, metrica, valor" }, { status: 400 });
  }

  const rows = lines.slice(1);
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(",").map((c) => c.trim());
    const fecha = cols[fechaIdx];
    const metrica = cols[metricaIdx];
    const valorStr = cols[valorIdx];
    const unidad = unidadIdx >= 0 ? cols[unidadIdx] : "";

    if (!fecha || !metrica || !valorStr) {
      errors.push(`Fila ${i + 2}: datos incompletos`);
      continue;
    }

    const valor = parseFloat(valorStr);
    if (isNaN(valor)) {
      errors.push(`Fila ${i + 2}: valor no válido`);
      continue;
    }

    const period = parseFechaMX(fecha);
    if (!period) {
      errors.push(`Fila ${i + 2}: fecha no válida`);
      continue;
    }

    await db.metric.create({
      data: {
        organizationId: membership.organizationId,
        category,
        name: metrica.slice(0, 100),
        value: valor,
        unit: UNIT_MAP[unidad] || unidad || null,
        period,
      },
    });
    imported++;
  }

  if (imported > 0) {
    try {
      await db.notification.create({
        data: {
          userId: session.user.id,
          title: "Importación completada",
          message: `${imported} registro(s) importados en ${category.toLowerCase()}.`,
          type: "import",
        },
      });
    } catch {}
  }

  return NextResponse.json({ imported, errors, total: rows.length });
}
