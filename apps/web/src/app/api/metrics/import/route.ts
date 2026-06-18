import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

const VALID_CATEGORIES = ["FINANCE", "SALES", "OPERATIONS", "HR"];

const UNIT_MAP: Record<string, string> = {
  MXN: "MXN", pesos: "MXN", unidades: "unidades", personas: "personas",
  porcentaje: "%", "%": "%", días: "días", pts: "pts",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string) || "";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const text = await file.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

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

    const period = new Date(fecha);
    if (isNaN(period.getTime())) {
      errors.push(`Fila ${i + 2}: fecha no válida`);
      continue;
    }

    await db.metric.create({
      data: {
        organizationId: membership.organizationId,
        category: category as any,
        name: metrica,
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
