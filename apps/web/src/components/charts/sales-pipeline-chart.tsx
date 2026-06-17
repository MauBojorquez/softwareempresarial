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
    <div className="rounded-xl border border-white/5 bg-card p-6">
      <h3 className="text-lg font-semibold">Pipeline de Ventas</h3>
      <p className="text-sm text-muted-foreground">Deals por etapa</p>
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={demoData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={90}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(225, 20%, 8%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value: number) =>
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
              }
            />
            <Bar
              dataKey="value"
              fill="url(#barGradient)"
              radius={[0, 6, 6, 0]}
              name="Valor"
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
