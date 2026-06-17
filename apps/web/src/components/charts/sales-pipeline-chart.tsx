"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const demoData = [
  { stage: "Prospecto", count: 45, value: 2250000 },
  { stage: "Calificado", count: 32, value: 1920000 },
  { stage: "Propuesta", count: 18, value: 1440000 },
  { stage: "Negociación", count: 12, value: 1080000 },
  { stage: "Cerrado", count: 8, value: 720000 },
];

export function SalesPipelineChart() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold">Pipeline de Ventas</h3>
      <p className="text-sm text-muted-foreground">Deals por etapa</p>
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={demoData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} className="text-xs" />
            <YAxis type="category" dataKey="stage" width={90} className="text-xs" />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
              }
            />
            <Bar dataKey="value" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} name="Valor" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
