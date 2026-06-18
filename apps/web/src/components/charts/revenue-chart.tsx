"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const demoData = [
  { month: "Ene", ingresos: 420000, gastos: 310000 },
  { month: "Feb", ingresos: 480000, gastos: 320000 },
  { month: "Mar", ingresos: 510000, gastos: 340000 },
  { month: "Abr", ingresos: 470000, gastos: 290000 },
  { month: "May", ingresos: 560000, gastos: 350000 },
  { month: "Jun", ingresos: 620000, gastos: 360000 },
];

export function RevenueChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground">Ingresos vs Gastos</h3>
      <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={demoData}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563a8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563a8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="month" stroke="rgba(0,0,0,0.3)" fontSize={12} />
            <YAxis stroke="rgba(0,0,0,0.3)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
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
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke="#2563a8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIngresos)"
              name="Ingresos"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke="#64748b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorGastos)"
              name="Gastos"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
