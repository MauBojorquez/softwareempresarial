import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import type { MetricCategory } from "@prisma/client";

// Converts a Google Sheets share URL to a CSV export URL.
function toCsvUrl(url: string): string | null {
  // Handles: /spreadsheets/d/SHEET_ID/edit... or /spreadsheets/d/SHEET_ID/pub...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const id = match[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// Parse a CSV string into rows of string arrays.
function parseCsv(text: string): string[][] {
  return text.split(/\r?\n/).filter(Boolean).map((line) =>
    line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim())
  );
}

const VALID_CATEGORIES: MetricCategory[] = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, category } = (await req.json()) as { url: string; category: MetricCategory };

  if (!url) return NextResponse.json({ error: "URL requerida" }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const csvUrl = toCsvUrl(url);
  if (!csvUrl) {
    return NextResponse.json({ error: "URL de Google Sheets inválida. Asegúrate de pegar el link completo de la hoja." }, { status: 400 });
  }

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 404 });

  let csvText: string;
  try {
    const res = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
    if (!res.ok) {
      return NextResponse.json({
        error: "No se pudo leer la hoja. Verifica que esté compartida como 'Cualquier persona con el enlace puede ver'.",
      }, { status: 400 });
    }
    csvText = await res.text();
  } catch {
    return NextResponse.json({ error: "Error al conectar con Google Sheets" }, { status: 500 });
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) return NextResponse.json({ error: "La hoja está vacía o sin datos" }, { status: 400 });

  // Expect header row: Nombre, Valor, Unidad (opt), Fecha (opt)
  const headers = rows[0]!.map((h) => h.toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => h.includes("nombre") || h.includes("name") || h.includes("concepto"));
  const valueIdx = headers.findIndex((h) => h.includes("valor") || h.includes("value") || h.includes("monto") || h.includes("amount"));
  const unitIdx = headers.findIndex((h) => h.includes("unidad") || h.includes("unit"));
  const dateIdx = headers.findIndex((h) => h.includes("fecha") || h.includes("date") || h.includes("período") || h.includes("periodo"));

  if (nameIdx === -1 || valueIdx === -1) {
    return NextResponse.json({
      error: `No se encontraron columnas requeridas. La hoja debe tener columnas: "Nombre" y "Valor". Encabezados detectados: ${rows[0]!.join(", ")}`,
    }, { status: 400 });
  }

  const records: Array<{ organizationId: string; category: MetricCategory; name: string; value: number; unit: string | null; period: Date }> = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const name = row[nameIdx]?.trim();
    const rawValue = row[valueIdx]?.replace(/[$,\s]/g, "");
    const value = parseFloat(rawValue ?? "");
    const unit = unitIdx >= 0 ? (row[unitIdx]?.trim() || null) : null;
    const rawDate = dateIdx >= 0 ? row[dateIdx]?.trim() : null;
    const period = rawDate ? new Date(rawDate) : new Date();

    if (!name || isNaN(value)) {
      errors.push(`Fila ${i + 1}: nombre o valor inválido`);
      continue;
    }
    if (rawDate && isNaN(period.getTime())) {
      errors.push(`Fila ${i + 1}: fecha inválida "${rawDate}"`);
      continue;
    }

    records.push({ organizationId: membership.organizationId, category, name, value, unit, period });
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "No se encontraron filas válidas", errors }, { status: 400 });
  }

  await db.metric.createMany({ data: records });

  return NextResponse.json({ imported: records.length, total: rows.length - 1, errors });
}
