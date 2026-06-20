"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

const demoData = [
  { stage: "Prospecto", value: 2250000 },
  { stage: "Calificado", value: 1920000 },
  { stage: "Propuesta", value: 1440000 },
  { stage: "Negociación", value: 1080000 },
  { stage: "Cerrado", value: 720000 },
];

const COLORS = ["#3D7FFF", "#4D8FFF", "#5BA0FF", "#6BB0FF", "#00E87B"];

export function SalesPipelineChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-foreground">Pipeline de Ventas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Valor por etapa</p>
      </div>
      <div
        className="h-[260px]"
        role="img"
        aria-label="Gráfica del valor del pipeline de ventas por etapa."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={demoData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              stroke="transparent"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={82}
              stroke="transparent"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(8,10,16,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                fontSize: 12,
              }}
              formatter={(value: number) =>
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
              }
              labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} name="Valor" maxBarSize={18}>
              {demoData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
