import { NextRequest, NextResponse } from "next/server";

const TEMPLATES: Record<string, { headers: string[]; examples: string[] }> = {
  FINANCE: {
    headers: ["fecha", "metrica", "valor", "unidad"],
    examples: ["2024-01-15,Ingresos,150000,MXN", "2024-01-15,Gastos,80000,MXN", "2024-01-15,Cuentas por Cobrar,25000,MXN", "2024-01-15,Cuentas por Pagar,15000,MXN", "2024-01-15,Flujo de Caja,70000,MXN"],
  },
  SALES: {
    headers: ["fecha", "metrica", "valor", "unidad"],
    examples: ["2024-01-15,Ventas del Mes,200000,MXN", "2024-01-15,Deals Cerrados,12,unidades", "2024-01-15,Nuevos Leads,45,unidades", "2024-01-15,Pipeline Total,500000,MXN", "2024-01-15,Ticket Promedio,16000,MXN"],
  },
  OPERATIONS: {
    headers: ["fecha", "metrica", "valor", "unidad"],
    examples: ["2024-01-15,Tareas Completadas,85,unidades", "2024-01-15,Incidencias,3,unidades", "2024-01-15,Tiempo Promedio (días),2.5,días", "2024-01-15,Eficiencia (%),92,porcentaje", "2024-01-15,SLA Cumplimiento (%),98,porcentaje", "2024-01-15,Costo por Operación,1500,MXN"],
  },
  HR: {
    headers: ["fecha", "metrica", "valor", "unidad"],
    examples: ["2024-01-15,Headcount,48,personas", "2024-01-15,Nuevas Contrataciones,3,personas", "2024-01-15,Bajas,1,personas", "2024-01-15,Rotación (%),4.2,porcentaje", "2024-01-15,Satisfacción (1-10),8.5,pts", "2024-01-15,Costo Nómina,350000,MXN"],
  },
};

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || "FINANCE";
  const template = TEMPLATES[category];
  if (!template) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const csv = [template.headers.join(","), ...template.examples].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=plantilla_${category.toLowerCase()}.csv`,
    },
  });
}
