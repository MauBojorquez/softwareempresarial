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
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground">Pipeline de Ventas</h3>
      <p className="text-sm text-muted-foreground">Deals por etapa</p>
      <div
        className="mt-4 h-[300px]"
        role="img"
        aria-label="Gráfica de barras del valor del pipeline de ventas por etapa."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={demoData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={90}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "8px",
                color: "#1a1a2e",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number) =>
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
              }
            />
            <Bar
              dataKey="value"
              fill="#2563a8"
              radius={[0, 6, 6, 0]}
              name="Valor"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
